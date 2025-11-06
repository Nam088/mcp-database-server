import { Client, Entry, SearchOptions } from "ldapts";
import { DatabaseAdapter } from "./base.js";

// LDAP adapter implementation using ldapts (alternative to deprecated ldapjs)
export class LDAPAdapter implements DatabaseAdapter {
  private client: Client | null = null;
  private url: string = "";
  private bindDN: string = "";
  private bindPassword: string = "";

  constructor(connectionString: string) {
    this.url = connectionString;
    const isTLS = connectionString.startsWith("ldaps://");
    const clientOptions: any = {
      url: connectionString,
    };

    // Add TLS options if using LDAPS
    if (isTLS) {
      clientOptions.tlsOptions = {
        rejectUnauthorized: process.env.LDAP_REJECT_UNAUTHORIZED !== "false",
      };
    }

    this.client = new Client(clientOptions);
  }

  async connect(bindDN?: string, bindPassword?: string): Promise<void> {
    if (!this.client) {
      throw new Error("LDAP client not initialized");
    }
    if (bindDN && bindPassword) {
      this.bindDN = bindDN;
      this.bindPassword = bindPassword;
      await this.bind(bindDN, bindPassword);
    }
  }

  async bind(dn: string, password: string): Promise<void> {
    if (!this.client) {
      throw new Error("LDAP client not initialized");
    }
    await this.client.bind(dn, password);
  }

  async unbind(): Promise<void> {
    if (!this.client) {
      throw new Error("LDAP client not initialized");
    }
    await this.client.unbind();
  }

  async search(
    base: string,
    filter: string,
    options: Partial<SearchOptions> = {}
  ): Promise<any[]> {
    if (!this.client) {
      throw new Error("LDAP client not initialized");
    }
    
    // Validate base DN for non-empty searches (empty base is allowed for root DSE queries)
    if (base && base.trim() !== "" && !base.match(/^[A-Z]+=/i)) {
      throw new Error(
        `Invalid base DN format: "${base}". Base DN should start with a component like DC=, OU=, or CN= (e.g., "DC=example,DC=com")`
      );
    }
    
    const searchOptions: SearchOptions = {
      filter,
      scope: options.scope || "sub",
      attributes: options.attributes || ["*"],
      sizeLimit: options.sizeLimit || 1000, // Default limit to prevent SizeLimitExceededError
      ...options,
    };

    try {
      const searchResult = await this.client.search(base, searchOptions);
      return searchResult.searchEntries.map((entry: Entry) => {
        const attributes: Record<string, any> = {};
        // Entry in ldapts: { dn: string, [index: string]: Buffer | Buffer[] | string[] | string }
        for (const [key, value] of Object.entries(entry)) {
          if (key !== 'dn') {
            // Convert Buffer/Buffer[] to string/string[] for better usability
            if (Buffer.isBuffer(value)) {
              attributes[key] = value.toString('utf8');
            } else if (Array.isArray(value) && value.length > 0 && Buffer.isBuffer(value[0])) {
              attributes[key] = value.map((v) => Buffer.isBuffer(v) ? v.toString('utf8') : v);
            } else {
              attributes[key] = value;
            }
          }
        }
        return {
          dn: entry.dn,
          attributes,
        };
      });
    } catch (error: any) {
      // Provide more helpful error messages for common LDAP errors
      if (error.message && error.message.includes("NO_OBJECT")) {
        throw new Error(
          `LDAP Error: NO_OBJECT (0x20) - The base DN "${base}" does not exist in the directory. ` +
          `Please verify the base DN is correct (e.g., "DC=example,DC=com"). ` +
          `Original error: ${error.message}`
        );
      }
      throw error;
    }
  }

  async add(dn: string, attributes: Record<string, string | string[]>): Promise<void> {
    if (!this.client) {
      throw new Error("LDAP client not initialized");
    }
    await this.client.add(dn, attributes);
  }

  async modify(dn: string, change: any): Promise<void> {
    if (!this.client) {
      throw new Error("LDAP client not initialized");
    }
    await this.client.modify(dn, change);
  }

  async delete(dn: string): Promise<void> {
    if (!this.client) {
      throw new Error("LDAP client not initialized");
    }
    await this.client.del(dn);
  }

  async compare(dn: string, attribute: string, value: string): Promise<boolean> {
    if (!this.client) {
      throw new Error("LDAP client not initialized");
    }
    const result = await this.client.compare(dn, attribute, value);
    return result;
  }

  async authenticate(dn: string, password: string): Promise<boolean> {
    try {
      await this.bind(dn, password);
      await this.unbind();
      // Re-bind with original credentials if they exist
      if (this.bindDN && this.bindPassword) {
        await this.bind(this.bindDN, this.bindPassword);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  // DatabaseAdapter interface implementation (for compatibility)
  async query(sql: string): Promise<any> {
    throw new Error("LDAP does not support SQL queries. Use LDAP-specific methods instead.");
  }

  async execute(sql: string, params?: any[]): Promise<any> {
    throw new Error("LDAP does not support SQL execution. Use LDAP-specific methods instead.");
  }

  async listTables(schema?: string): Promise<string[]> {
    // In LDAP, we can list organizational units or containers
    const base = schema || "";
    const entries = await this.search(base, "(objectClass=*)", {
      scope: "one",
      attributes: ["ou", "cn", "dc"],
    });
    return entries.map((entry) => entry.dn);
  }

  async describeTable(table: string, schema?: string): Promise<any> {
    // In LDAP, describe an entry
    const entries = await this.search(table, "(objectClass=*)", {
      scope: "base",
      attributes: ["*"],
    });
    return entries[0] || null;
  }

  async listSchemas(): Promise<string[]> {
    // LDAP doesn't have schemas in the SQL sense
    return [];
  }

  async explainQuery(sql: string): Promise<any> {
    throw new Error("LDAP does not support EXPLAIN queries.");
  }

  async getIndexes(table: string, schema?: string): Promise<any[]> {
    // LDAP doesn't have indexes in the SQL sense
    return [];
  }

  async getForeignKeys(table: string, schema?: string): Promise<any[]> {
    // LDAP doesn't have foreign keys
    return [];
  }

  async getTableSize(table: string, schema?: string): Promise<any> {
    // LDAP doesn't have table size concept
    return {
      dn: table,
      size: "N/A",
      size_bytes: 0,
      rows: 0,
    };
  }

  async listViews(schema?: string): Promise<string[]> {
    // LDAP doesn't have views
    return [];
  }

  async describeView(view: string, schema?: string): Promise<any> {
    throw new Error("LDAP does not support views.");
  }

  async searchTables(pattern: string, schema?: string): Promise<string[]> {
    const base = schema || "";
    const entries = await this.search(base, `(|(cn=*${pattern}*)(ou=*${pattern}*)(dc=*${pattern}*))`, {
      scope: "sub",
      attributes: ["dn"],
    });
    return entries.map((entry) => entry.dn);
  }

  async getTableStats(table: string, schema?: string): Promise<any> {
    const entries = await this.search(table, "(objectClass=*)", {
      scope: "sub",
      attributes: ["dn"],
    });
    return {
      dn: table,
      row_count: entries.length,
      total_size: "N/A",
      table_size: "N/A",
      indexes_size: "N/A",
    };
  }

  /**
   * Search for folder structure in LDAP directory
   * Returns organizational units, containers, and domain components in a hierarchical structure
   */
  async searchFolderStructure(
    base: string = "",
    depth: number = 10,
    includeEntries: boolean = false
  ): Promise<any> {
    if (!this.client) {
      throw new Error("LDAP client not initialized");
    }

    // If base is empty, try to discover the root DSE
    let searchBase = base;
    if (!searchBase || searchBase.trim() === "") {
      try {
        // Try to get root DSE to discover base DN
        const rootDSE = await this.search("", "(objectClass=*)", {
          scope: "base",
          attributes: ["namingContexts", "defaultNamingContext", "rootDomainNamingContext"],
        });
        
        if (rootDSE.length > 0 && rootDSE[0].attributes) {
          const attrs = rootDSE[0].attributes;
          // Try defaultNamingContext first, then namingContexts, then rootDomainNamingContext
          if (attrs.defaultNamingContext) {
            searchBase = Array.isArray(attrs.defaultNamingContext) 
              ? attrs.defaultNamingContext[0] 
              : attrs.defaultNamingContext;
          } else if (attrs.namingContexts) {
            const contexts = Array.isArray(attrs.namingContexts) 
              ? attrs.namingContexts 
              : [attrs.namingContexts];
            searchBase = contexts[0];
          } else if (attrs.rootDomainNamingContext) {
            searchBase = Array.isArray(attrs.rootDomainNamingContext) 
              ? attrs.rootDomainNamingContext[0] 
              : attrs.rootDomainNamingContext;
          }
        }
        
        if (!searchBase || searchBase.trim() === "") {
          throw new Error(
            "Empty base DN provided and could not auto-discover root DN. " +
            "Please provide a valid base DN (e.g., 'DC=example,DC=com'). " +
            "LDAP Error: NO_OBJECT (0x20) - The specified base DN does not exist."
          );
        }
      } catch (error: any) {
        if (error.message && error.message.includes("NO_OBJECT")) {
          throw new Error(
            "Empty base DN provided and root DSE search failed. " +
            "Please provide a valid base DN (e.g., 'DC=example,DC=com'). " +
            "LDAP Error: NO_OBJECT (0x20) - The specified base DN does not exist."
          );
        }
        throw error;
      }
    }

    // Search for organizational units, containers, and domain components
    // Common object classes that represent folder-like structures
    const filter = "(|(objectClass=organizationalUnit)(objectClass=container)(objectClass=domain)(objectClass=domainDNS)(objectClass=builtinDomain))";
    
    const entries = await this.search(searchBase, filter, {
      scope: "sub",
      attributes: ["dn", "ou", "cn", "dc", "objectClass", "description", "name"],
    });

    // Build tree structure from DNs
    const tree: any = {};
    const entryMap = new Map<string, any>();

    // First pass: create entry objects
    for (const entry of entries) {
      const dn = entry.dn;
      const parts = dn.split(",").map((p: string) => p.trim());
      
      // Extract name and type from DN
      let name = "";
      let type = "";
      for (const part of parts) {
        if (part.startsWith("OU=")) {
          name = part.substring(3);
          type = "OU";
          break;
        } else if (part.startsWith("CN=")) {
          name = part.substring(3);
          type = "CN";
          break;
        } else if (part.startsWith("DC=")) {
          if (!name) {
            name = part.substring(3);
            type = "DC";
          }
        }
      }

      entryMap.set(dn, {
        dn,
        name: name || dn,
        type,
        attributes: entry.attributes,
        children: [],
        parent: null,
      });
    }

    // Second pass: build parent-child relationships
    for (const [dn, entry] of entryMap.entries()) {
      const parts = dn.split(",");
      if (parts.length > 1) {
        // Find parent DN (everything after the first component)
        const parentDN = parts.slice(1).join(",");
        const parent = entryMap.get(parentDN);
        if (parent) {
          entry.parent = parentDN;
          parent.children.push(entry);
        }
      }
    }

    // Find root entries (entries without parents in our map)
    const rootEntries: any[] = [];
    for (const [dn, entry] of entryMap.entries()) {
      if (!entry.parent || !entryMap.has(entry.parent)) {
        rootEntries.push(entry);
      }
    }

    // Build hierarchical structure
    const buildTree = (entry: any, currentDepth: number = 0): any => {
      if (currentDepth >= depth) {
        return null;
      }

      const node: any = {
        dn: entry.dn,
        name: entry.name,
        type: entry.type,
        attributes: includeEntries ? entry.attributes : undefined,
      };

      if (entry.children.length > 0) {
        node.children = entry.children
          .map((child: any) => buildTree(child, currentDepth + 1))
          .filter((child: any) => child !== null);
      }

      return node;
    };

    const structure = rootEntries.map((entry) => buildTree(entry));

    return {
      base: searchBase,
      total_entries: entries.length,
      structure: structure.length === 1 ? structure[0] : structure,
    };
  }

  /**
   * Get a flat list of all folders (OUs, containers, domains) in the directory
   */
  async listFolders(base: string = ""): Promise<string[]> {
    const result = await this.searchFolderStructure(base, 1, false);
    const folders: string[] = [];

    const collectDNs = (node: any) => {
      if (node) {
        folders.push(node.dn);
        if (node.children) {
          node.children.forEach(collectDNs);
        }
      }
    };

    if (Array.isArray(result.structure)) {
      result.structure.forEach(collectDNs);
    } else if (result.structure) {
      collectDNs(result.structure);
    }

    return folders;
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.unbind();
      this.client = null;
    }
  }
}
