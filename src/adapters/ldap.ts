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
    this.client = new Client({
      url: connectionString,
    });
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
    const searchOptions: SearchOptions = {
      filter,
      scope: options.scope || "sub",
      attributes: options.attributes || ["*"],
      ...options,
    };

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

  async close(): Promise<void> {
    if (this.client) {
      await this.unbind();
      this.client = null;
    }
  }
}
