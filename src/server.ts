import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { DatabaseAdapter } from "./adapters/base.js";

// MCP Server implementation
export class DatabaseMCPServer {
  private server: Server;
  private adapter: DatabaseAdapter | null = null;
  private isRedis: boolean = false;
  private isMongo: boolean = false;
  private isLDAP: boolean = false;
  private readOnly: boolean = false;

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
    // Check adapter type using constructor name to avoid importing unused adapters
    const adapterType = adapter.constructor.name;
    this.isRedis = adapterType === "RedisAdapter";
    this.isMongo = adapterType === "MongoAdapter";
    this.isLDAP = adapterType === "LDAPAdapter";
    // Check READ_ONLY_MODE environment variable (default: true for safety)
    // Set to "false" or "0" explicitly to enable write operations
    this.readOnly = process.env.READ_ONLY_MODE !== "false" && process.env.READ_ONLY_MODE !== "0";
    this.server = new Server(
      {
        name: "@nam088/mcp-database-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private checkReadOnly(): void {
    if (this.readOnly) {
      throw new Error("Server is running in read-only mode. Write operations are disabled.");
    }
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [];

      // Only add SQL tools for PostgreSQL (not Redis, MongoDB, or LDAP)
      if (!this.isRedis && !this.isMongo && !this.isLDAP) {
        tools.push(
          {
            name: "query",
            description: "Execute a SELECT SQL query and return results",
            inputSchema: {
              type: "object",
              properties: {
                sql: {
                  type: "string",
                  description: "SQL SELECT query to execute",
                },
              },
              required: ["sql"],
            },
          },
          {
            name: "execute_sql",
            description: "Execute any SQL command (INSERT, UPDATE, DELETE, CREATE, etc.)",
            inputSchema: {
              type: "object",
              properties: {
                sql: {
                  type: "string",
                  description: "SQL command to execute",
                },
              },
              required: ["sql"],
            },
          },
          {
            name: "list_tables",
            description: "List all tables in the database",
            inputSchema: {
              type: "object",
              properties: {
                schema: {
                  type: "string",
                  description: "Schema name (default: 'public')",
                  default: "public",
                },
              },
            },
          },
          {
            name: "describe_table",
            description: "Get detailed schema information for a table",
            inputSchema: {
              type: "object",
              properties: {
                table: {
                  type: "string",
                  description: "Table name",
                },
                schema: {
                  type: "string",
                  description: "Schema name (default: 'public')",
                  default: "public",
                },
              },
              required: ["table"],
            },
          },
          {
            name: "list_schemas",
            description: "List all schemas in the database",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "explain_query",
            description: "Get query execution plan using EXPLAIN",
            inputSchema: {
              type: "object",
              properties: {
                sql: {
                  type: "string",
                  description: "SQL query to explain",
                },
              },
              required: ["sql"],
            },
          },
          {
            name: "get_indexes",
            description: "Get all indexes for a table",
            inputSchema: {
              type: "object",
              properties: {
                table: {
                  type: "string",
                  description: "Table name",
                },
                schema: {
                  type: "string",
                  description: "Schema name (default: 'public')",
                  default: "public",
                },
              },
              required: ["table"],
            },
          },
          {
            name: "get_foreign_keys",
            description: "Get all foreign keys for a table",
            inputSchema: {
              type: "object",
              properties: {
                table: {
                  type: "string",
                  description: "Table name",
                },
                schema: {
                  type: "string",
                  description: "Schema name (default: 'public')",
                  default: "public",
                },
              },
              required: ["table"],
            },
          },
          {
            name: "get_table_size",
            description: "Get table size information (size, row count)",
            inputSchema: {
              type: "object",
              properties: {
                table: {
                  type: "string",
                  description: "Table name",
                },
                schema: {
                  type: "string",
                  description: "Schema name (default: 'public')",
                  default: "public",
                },
              },
              required: ["table"],
            },
          },
          {
            name: "list_views",
            description: "List all views in a schema",
            inputSchema: {
              type: "object",
              properties: {
                schema: {
                  type: "string",
                  description: "Schema name (default: 'public')",
                  default: "public",
                },
              },
            },
          },
          {
            name: "describe_view",
            description: "Get view definition",
            inputSchema: {
              type: "object",
              properties: {
                view: {
                  type: "string",
                  description: "View name",
                },
                schema: {
                  type: "string",
                  description: "Schema name (default: 'public')",
                  default: "public",
                },
              },
              required: ["view"],
            },
          },
          {
            name: "search_tables",
            description: "Search tables by name pattern",
            inputSchema: {
              type: "object",
              properties: {
                pattern: {
                  type: "string",
                  description: "Search pattern (supports wildcards)",
                },
                schema: {
                  type: "string",
                  description: "Schema name (default: 'public')",
                  default: "public",
                },
              },
              required: ["pattern"],
            },
          },
          {
            name: "get_table_stats",
            description: "Get detailed table statistics (row count, sizes)",
            inputSchema: {
              type: "object",
              properties: {
                table: {
                  type: "string",
                  description: "Table name",
                },
                schema: {
                  type: "string",
                  description: "Schema name (default: 'public')",
                  default: "public",
                },
              },
              required: ["table"],
            },
          }
        );
      }

      // Add Redis-specific tools if using Redis adapter
      if (this.isRedis) {
        const redisAdapter = this.adapter as any;
        tools.push(
          {
            name: "redis_get",
            description: "Get value of a Redis key",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Redis key",
                },
              },
              required: ["key"],
            },
          },
          {
            name: "redis_set",
            description: "Set value of a Redis key",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Redis key",
                },
                value: {
                  type: "string",
                  description: "Value to set",
                },
                ttl: {
                  type: "number",
                  description: "Time to live in seconds (optional)",
                },
              },
              required: ["key", "value"],
            },
          },
          {
            name: "redis_del",
            description: "Delete one or more Redis keys",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Redis key to delete",
                },
              },
              required: ["key"],
            },
          },
          {
            name: "redis_keys",
            description: "Find all keys matching a pattern",
            inputSchema: {
              type: "object",
              properties: {
                pattern: {
                  type: "string",
                  description: "Pattern to match (e.g., 'user:*')",
                },
              },
              required: ["pattern"],
            },
          },
          {
            name: "redis_exists",
            description: "Check if a key exists",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Redis key",
                },
              },
              required: ["key"],
            },
          },
          {
            name: "redis_ttl",
            description: "Get time to live of a key",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Redis key",
                },
              },
              required: ["key"],
            },
          },
          {
            name: "redis_expire",
            description: "Set expiration time for a key",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Redis key",
                },
                seconds: {
                  type: "number",
                  description: "Expiration time in seconds",
                },
              },
              required: ["key", "seconds"],
            },
          },
          {
            name: "redis_type",
            description: "Get type of a Redis key",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Redis key",
                },
              },
              required: ["key"],
            },
          },
          {
            name: "redis_dbsize",
            description: "Get number of keys in current database",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "redis_info",
            description: "Get Redis server information",
            inputSchema: {
              type: "object",
              properties: {
                section: {
                  type: "string",
                  description: "Info section (optional, e.g., 'memory', 'stats')",
                },
              },
            },
          },
          {
            name: "redis_hget",
            description: "Get value from a hash field",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Hash key",
                },
                field: {
                  type: "string",
                  description: "Field name",
                },
              },
              required: ["key", "field"],
            },
          },
          {
            name: "redis_hset",
            description: "Set value in a hash field",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Hash key",
                },
                field: {
                  type: "string",
                  description: "Field name",
                },
                value: {
                  type: "string",
                  description: "Field value",
                },
              },
              required: ["key", "field", "value"],
            },
          },
          {
            name: "redis_hgetall",
            description: "Get all fields and values from a hash",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Hash key",
                },
              },
              required: ["key"],
            },
          },
          {
            name: "redis_lrange",
            description: "Get range of elements from a list",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "List key",
                },
                start: {
                  type: "number",
                  description: "Start index",
                },
                stop: {
                  type: "number",
                  description: "Stop index",
                },
              },
              required: ["key", "start", "stop"],
            },
          },
          {
            name: "redis_smembers",
            description: "Get all members of a set",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Set key",
                },
              },
              required: ["key"],
            },
          },
          {
            name: "redis_zrange",
            description: "Get range of members from a sorted set",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Sorted set key",
                },
                start: {
                  type: "number",
                  description: "Start index",
                },
                stop: {
                  type: "number",
                  description: "Stop index",
                },
                with_scores: {
                  type: "boolean",
                  description: "Include scores in result",
                },
              },
              required: ["key", "start", "stop"],
            },
          }
        );
      }

      // Add MongoDB-specific tools if using MongoDB adapter
      if (this.isMongo) {
        const mongoAdapter = this.adapter as any;
        tools.push(
          {
            name: "mongo_find",
            description: "Find documents in a MongoDB collection",
            inputSchema: {
              type: "object",
              properties: {
                collection: {
                  type: "string",
                  description: "Collection name",
                },
                filter: {
                  type: "object",
                  description: "Filter query (JSON object)",
                },
                limit: {
                  type: "number",
                  description: "Maximum number of documents to return (default: 100)",
                  default: 100,
                },
                skip: {
                  type: "number",
                  description: "Number of documents to skip (default: 0)",
                  default: 0,
                },
              },
              required: ["collection"],
            },
          },
          {
            name: "mongo_find_one",
            description: "Find one document in a MongoDB collection",
            inputSchema: {
              type: "object",
              properties: {
                collection: {
                  type: "string",
                  description: "Collection name",
                },
                filter: {
                  type: "object",
                  description: "Filter query (JSON object)",
                },
              },
              required: ["collection"],
            },
          },
          {
            name: "mongo_insert_one",
            description: "Insert one document into a MongoDB collection",
            inputSchema: {
              type: "object",
              properties: {
                collection: {
                  type: "string",
                  description: "Collection name",
                },
                document: {
                  type: "object",
                  description: "Document to insert (JSON object)",
                },
              },
              required: ["collection", "document"],
            },
          },
          {
            name: "mongo_insert_many",
            description: "Insert multiple documents into a MongoDB collection",
            inputSchema: {
              type: "object",
              properties: {
                collection: {
                  type: "string",
                  description: "Collection name",
                },
                documents: {
                  type: "array",
                  description: "Array of documents to insert",
                  items: {
                    type: "object",
                  },
                },
              },
              required: ["collection", "documents"],
            },
          },
          {
            name: "mongo_update_one",
            description: "Update one document in a MongoDB collection",
            inputSchema: {
              type: "object",
              properties: {
                collection: {
                  type: "string",
                  description: "Collection name",
                },
                filter: {
                  type: "object",
                  description: "Filter query to find document",
                },
                update: {
                  type: "object",
                  description: "Update fields (JSON object)",
                },
              },
              required: ["collection", "filter", "update"],
            },
          },
          {
            name: "mongo_update_many",
            description: "Update multiple documents in a MongoDB collection",
            inputSchema: {
              type: "object",
              properties: {
                collection: {
                  type: "string",
                  description: "Collection name",
                },
                filter: {
                  type: "object",
                  description: "Filter query to find documents",
                },
                update: {
                  type: "object",
                  description: "Update fields (JSON object)",
                },
              },
              required: ["collection", "filter", "update"],
            },
          },
          {
            name: "mongo_delete_one",
            description: "Delete one document from a MongoDB collection",
            inputSchema: {
              type: "object",
              properties: {
                collection: {
                  type: "string",
                  description: "Collection name",
                },
                filter: {
                  type: "object",
                  description: "Filter query to find document",
                },
              },
              required: ["collection", "filter"],
            },
          },
          {
            name: "mongo_delete_many",
            description: "Delete multiple documents from a MongoDB collection",
            inputSchema: {
              type: "object",
              properties: {
                collection: {
                  type: "string",
                  description: "Collection name",
                },
                filter: {
                  type: "object",
                  description: "Filter query to find documents",
                },
              },
              required: ["collection", "filter"],
            },
          },
          {
            name: "mongo_count",
            description: "Count documents in a MongoDB collection",
            inputSchema: {
              type: "object",
              properties: {
                collection: {
                  type: "string",
                  description: "Collection name",
                },
                filter: {
                  type: "object",
                  description: "Filter query (optional)",
                },
              },
              required: ["collection"],
            },
          },
          {
            name: "mongo_aggregate",
            description: "Run aggregation pipeline on a MongoDB collection",
            inputSchema: {
              type: "object",
              properties: {
                collection: {
                  type: "string",
                  description: "Collection name",
                },
                pipeline: {
                  type: "array",
                  description: "Aggregation pipeline (array of stages)",
                  items: {
                    type: "object",
                  },
                },
              },
              required: ["collection", "pipeline"],
            },
          },
          {
            name: "mongo_list_collections",
            description: "List all collections in the database",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "mongo_get_collection_stats",
            description: "Get statistics for a MongoDB collection",
            inputSchema: {
              type: "object",
              properties: {
                collection: {
                  type: "string",
                  description: "Collection name",
                },
              },
              required: ["collection"],
            },
          },
          {
            name: "mongo_get_indexes",
            description: "Get indexes for a MongoDB collection",
            inputSchema: {
              type: "object",
              properties: {
                collection: {
                  type: "string",
                  description: "Collection name",
                },
              },
              required: ["collection"],
            },
          },
          {
            name: "mongo_create_index",
            description: "Create an index on a MongoDB collection",
            inputSchema: {
              type: "object",
              properties: {
                collection: {
                  type: "string",
                  description: "Collection name",
                },
                keys: {
                  type: "object",
                  description: "Index keys (e.g., { name: 1, age: -1 })",
                },
                options: {
                  type: "object",
                  description: "Index options (e.g., { unique: true })",
                },
              },
              required: ["collection", "keys"],
            },
          },
          {
            name: "mongo_get_database_stats",
            description: "Get statistics for the MongoDB database",
            inputSchema: {
              type: "object",
              properties: {},
            },
          }
        );
      }

      // Add LDAP-specific tools if using LDAP adapter
      if (this.isLDAP) {
        const ldapAdapter = this.adapter as any;
        tools.push(
          {
            name: "ldap_search",
            description: "Search LDAP directory entries",
            inputSchema: {
              type: "object",
              properties: {
                base: {
                  type: "string",
                  description: "Base DN for search (e.g., 'dc=example,dc=com')",
                },
                filter: {
                  type: "string",
                  description: "LDAP filter (e.g., '(cn=John Doe)')",
                },
                scope: {
                  type: "string",
                  description: "Search scope: 'base', 'one', or 'sub' (default: 'sub')",
                  enum: ["base", "one", "sub"],
                  default: "sub",
                },
                attributes: {
                  type: "array",
                  description: "Attributes to return (default: ['*'] for all)",
                  items: {
                    type: "string",
                  },
                },
              },
              required: ["base", "filter"],
            },
          },
          {
            name: "ldap_authenticate",
            description: "Authenticate a user with DN and password",
            inputSchema: {
              type: "object",
              properties: {
                dn: {
                  type: "string",
                  description: "Distinguished Name (e.g., 'cn=user,dc=example,dc=com')",
                },
                password: {
                  type: "string",
                  description: "Password",
                },
              },
              required: ["dn", "password"],
            },
          },
          {
            name: "ldap_add",
            description: "Add a new LDAP entry",
            inputSchema: {
              type: "object",
              properties: {
                dn: {
                  type: "string",
                  description: "Distinguished Name for new entry",
                },
                attributes: {
                  type: "object",
                  description: "Entry attributes (e.g., { cn: 'John', sn: 'Doe', objectClass: ['person'] })",
                },
              },
              required: ["dn", "attributes"],
            },
          },
          {
            name: "ldap_modify",
            description: "Modify an LDAP entry",
            inputSchema: {
              type: "object",
              properties: {
                dn: {
                  type: "string",
                  description: "Distinguished Name of entry to modify",
                },
                change: {
                  type: "object",
                  description: "Modification change object",
                },
              },
              required: ["dn", "change"],
            },
          },
          {
            name: "ldap_delete",
            description: "Delete an LDAP entry",
            inputSchema: {
              type: "object",
              properties: {
                dn: {
                  type: "string",
                  description: "Distinguished Name of entry to delete",
                },
              },
              required: ["dn"],
            },
          },
          {
            name: "ldap_compare",
            description: "Compare an attribute value of an LDAP entry",
            inputSchema: {
              type: "object",
              properties: {
                dn: {
                  type: "string",
                  description: "Distinguished Name",
                },
                attribute: {
                  type: "string",
                  description: "Attribute name to compare",
                },
                value: {
                  type: "string",
                  description: "Value to compare",
                },
              },
              required: ["dn", "attribute", "value"],
            },
          },
          {
            name: "ldap_search_folder_structure",
            description: "Search for folder structure in LDAP directory (organizational units, containers, domains) and return hierarchical structure",
            inputSchema: {
              type: "object",
              properties: {
                base: {
                  type: "string",
                  description: "Base DN for search (e.g., 'dc=example,dc=com'). Empty string searches from root.",
                  default: "",
                },
                depth: {
                  type: "number",
                  description: "Maximum depth to traverse (default: 10)",
                  default: 10,
                },
                include_entries: {
                  type: "boolean",
                  description: "Include full entry attributes in result (default: false)",
                  default: false,
                },
              },
            },
          },
          {
            name: "ldap_list_folders",
            description: "Get a flat list of all folders (OUs, containers, domains) in the LDAP directory",
            inputSchema: {
              type: "object",
              properties: {
                base: {
                  type: "string",
                  description: "Base DN for search (e.g., 'dc=example,dc=com'). Empty string searches from root.",
                  default: "",
                },
              },
            },
          }
        );
      }

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      if (!this.adapter) {
        throw new Error("Database adapter not initialized");
      }

      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "query": {
            const { sql } = args as { sql: string };
            if (!sql.trim().toUpperCase().startsWith("SELECT")) {
              throw new Error("Query tool only supports SELECT statements");
            }
            const result = await this.adapter.query(sql);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case "execute_sql": {
            this.checkReadOnly();
            const { sql } = args as { sql: string };
            const result = await this.adapter.execute(sql);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case "list_tables": {
            const schema = (args as { schema?: string })?.schema || "public";
            const tables = await this.adapter.listTables(schema);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      tables,
                      schema,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case "describe_table": {
            const { table, schema = "public" } = args as {
              table: string;
              schema?: string;
            };
            const schemaInfo = await this.adapter.describeTable(table, schema);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(schemaInfo, null, 2),
                },
              ],
            };
          }

          case "list_schemas": {
            const schemas = await this.adapter.listSchemas();
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ schemas }, null, 2),
                },
              ],
            };
          }

          case "explain_query": {
            const { sql } = args as { sql: string };
            const result = await this.adapter.explainQuery(sql);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case "get_indexes": {
            const { table, schema = "public" } = args as {
              table: string;
              schema?: string;
            };
            const indexes = await this.adapter.getIndexes(table, schema);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ table, schema, indexes }, null, 2),
                },
              ],
            };
          }

          case "get_foreign_keys": {
            const { table, schema = "public" } = args as {
              table: string;
              schema?: string;
            };
            const foreignKeys = await this.adapter.getForeignKeys(table, schema);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ table, schema, foreign_keys: foreignKeys }, null, 2),
                },
              ],
            };
          }

          case "get_table_size": {
            const { table, schema = "public" } = args as {
              table: string;
              schema?: string;
            };
            const sizeInfo = await this.adapter.getTableSize(table, schema);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(sizeInfo, null, 2),
                },
              ],
            };
          }

          case "list_views": {
            const schema = (args as { schema?: string })?.schema || "public";
            const views = await this.adapter.listViews(schema);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ views, schema }, null, 2),
                },
              ],
            };
          }

          case "describe_view": {
            const { view, schema = "public" } = args as {
              view: string;
              schema?: string;
            };
            const viewInfo = await this.adapter.describeView(view, schema);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(viewInfo, null, 2),
                },
              ],
            };
          }

          case "search_tables": {
            const { pattern, schema = "public" } = args as {
              pattern: string;
              schema?: string;
            };
            const tables = await this.adapter.searchTables(pattern, schema);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ tables, pattern, schema }, null, 2),
                },
              ],
            };
          }

          case "get_table_stats": {
            const { table, schema = "public" } = args as {
              table: string;
              schema?: string;
            };
            const stats = await this.adapter.getTableStats(table, schema);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(stats, null, 2),
                },
              ],
            };
          }

          // Redis-specific tools
          case "redis_get": {
            if (!this.isRedis) {
              throw new Error("This tool is only available for Redis");
            }
            const redisAdapter = this.adapter as any;
            const { key } = args as { key: string };
            const value = await redisAdapter.get(key);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ key, value }, null, 2),
                },
              ],
            };
          }

          case "redis_set": {
            this.checkReadOnly();
            if (!this.isRedis) {
              throw new Error("This tool is only available for Redis");
            }
            const redisAdapter = this.adapter as any;
            const { key, value, ttl } = args as { key: string; value: string; ttl?: number };
            await redisAdapter.set(key, value, ttl);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ key, value, ttl: ttl || null, status: "OK" }, null, 2),
                },
              ],
            };
          }

          case "redis_del": {
            this.checkReadOnly();
            if (!this.isRedis) {
              throw new Error("This tool is only available for Redis");
            }
            const redisAdapter = this.adapter as any;
            const { key } = args as { key: string };
            const deleted = await redisAdapter.del(key);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ key, deleted }, null, 2),
                },
              ],
            };
          }

          case "redis_keys": {
            if (!this.isRedis) {
              throw new Error("This tool is only available for Redis");
            }
            const redisAdapter = this.adapter as any;
            const { pattern } = args as { pattern: string };
            const keys = await redisAdapter.keys(pattern);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ pattern, keys, count: keys.length }, null, 2),
                },
              ],
            };
          }

          case "redis_exists": {
            if (!this.isRedis) {
              throw new Error("This tool is only available for Redis");
            }
            const redisAdapter = this.adapter as any;
            const { key } = args as { key: string };
            const exists = await redisAdapter.exists(key);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ key, exists }, null, 2),
                },
              ],
            };
          }

          case "redis_ttl": {
            if (!this.isRedis) {
              throw new Error("This tool is only available for Redis");
            }
            const redisAdapter = this.adapter as any;
            const { key } = args as { key: string };
            const ttl = await redisAdapter.ttl(key);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ key, ttl }, null, 2),
                },
              ],
            };
          }

          case "redis_expire": {
            this.checkReadOnly();
            if (!this.isRedis) {
              throw new Error("This tool is only available for Redis");
            }
            const redisAdapter = this.adapter as any;
            const { key, seconds } = args as { key: string; seconds: number };
            const result = await redisAdapter.expire(key, seconds);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ key, seconds, result }, null, 2),
                },
              ],
            };
          }

          case "redis_type": {
            if (!this.isRedis) {
              throw new Error("This tool is only available for Redis");
            }
            const redisAdapter = this.adapter as any;
            const { key } = args as { key: string };
            const type = await redisAdapter.type(key);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ key, type }, null, 2),
                },
              ],
            };
          }

          case "redis_dbsize": {
            if (!this.isRedis) {
              throw new Error("This tool is only available for Redis");
            }
            const redisAdapter = this.adapter as any;
            const size = await redisAdapter.dbsize();
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ dbsize: size }, null, 2),
                },
              ],
            };
          }

          case "redis_info": {
            if (!this.isRedis) {
              throw new Error("This tool is only available for Redis");
            }
            const redisAdapter = this.adapter as any;
            const { section } = args as { section?: string };
            const info = await redisAdapter.info(section);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ section: section || "all", info }, null, 2),
                },
              ],
            };
          }

          case "redis_hget": {
            if (!this.isRedis) {
              throw new Error("This tool is only available for Redis");
            }
            const redisAdapter = this.adapter as any;
            const { key, field } = args as { key: string; field: string };
            const value = await redisAdapter.hget(key, field);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ key, field, value }, null, 2),
                },
              ],
            };
          }

          case "redis_hset": {
            this.checkReadOnly();
            if (!this.isRedis) {
              throw new Error("This tool is only available for Redis");
            }
            const redisAdapter = this.adapter as any;
            const { key, field, value } = args as { key: string; field: string; value: string };
            const result = await redisAdapter.hset(key, field, value);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ key, field, value, result }, null, 2),
                },
              ],
            };
          }

          case "redis_hgetall": {
            if (!this.isRedis) {
              throw new Error("This tool is only available for Redis");
            }
            const redisAdapter = this.adapter as any;
            const { key } = args as { key: string };
            const hash = await redisAdapter.hgetall(key);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ key, hash }, null, 2),
                },
              ],
            };
          }

          case "redis_lrange": {
            if (!this.isRedis) {
              throw new Error("This tool is only available for Redis");
            }
            const redisAdapter = this.adapter as any;
            const { key, start, stop } = args as { key: string; start: number; stop: number };
            const list = await redisAdapter.lrange(key, start, stop);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ key, start, stop, list }, null, 2),
                },
              ],
            };
          }

          case "redis_smembers": {
            if (!this.isRedis) {
              throw new Error("This tool is only available for Redis");
            }
            const redisAdapter = this.adapter as any;
            const { key } = args as { key: string };
            const members = await redisAdapter.smembers(key);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ key, members }, null, 2),
                },
              ],
            };
          }

          case "redis_zrange": {
            if (!this.isRedis) {
              throw new Error("This tool is only available for Redis");
            }
            const redisAdapter = this.adapter as any;
            const { key, start, stop, with_scores } = args as {
              key: string;
              start: number;
              stop: number;
              with_scores?: boolean;
            };
            const members = await redisAdapter.zrange(key, start, stop, with_scores);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ key, start, stop, with_scores, members }, null, 2),
                },
              ],
            };
          }

          // MongoDB-specific tools
          case "mongo_find": {
            if (!this.isMongo) {
              throw new Error("This tool is only available for MongoDB");
            }
            const mongoAdapter = this.adapter as any;
            const { collection, filter = {}, limit = 100, skip = 0 } = args as {
              collection: string;
              filter?: any;
              limit?: number;
              skip?: number;
            };
            const documents = await mongoAdapter.find(collection, filter, limit, skip);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ collection, filter, limit, skip, documents, count: documents.length }, null, 2),
                },
              ],
            };
          }

          case "mongo_find_one": {
            if (!this.isMongo) {
              throw new Error("This tool is only available for MongoDB");
            }
            const mongoAdapter = this.adapter as any;
            const { collection, filter = {} } = args as {
              collection: string;
              filter?: any;
            };
            const document = await mongoAdapter.findOne(collection, filter);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ collection, filter, document }, null, 2),
                },
              ],
            };
          }

          case "mongo_insert_one": {
            this.checkReadOnly();
            if (!this.isMongo) {
              throw new Error("This tool is only available for MongoDB");
            }
            const mongoAdapter = this.adapter as any;
            const { collection, document } = args as {
              collection: string;
              document: any;
            };
            const id = await mongoAdapter.insertOne(collection, document);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ collection, document, inserted_id: id }, null, 2),
                },
              ],
            };
          }

          case "mongo_insert_many": {
            this.checkReadOnly();
            if (!this.isMongo) {
              throw new Error("This tool is only available for MongoDB");
            }
            const mongoAdapter = this.adapter as any;
            const { collection, documents } = args as {
              collection: string;
              documents: any[];
            };
            const ids = await mongoAdapter.insertMany(collection, documents);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ collection, documents, inserted_ids: ids, count: ids.length }, null, 2),
                },
              ],
            };
          }

          case "mongo_update_one": {
            this.checkReadOnly();
            if (!this.isMongo) {
              throw new Error("This tool is only available for MongoDB");
            }
            const mongoAdapter = this.adapter as any;
            const { collection, filter, update } = args as {
              collection: string;
              filter: any;
              update: any;
            };
            const modified = await mongoAdapter.updateOne(collection, filter, update);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ collection, filter, update, modified_count: modified }, null, 2),
                },
              ],
            };
          }

          case "mongo_update_many": {
            this.checkReadOnly();
            if (!this.isMongo) {
              throw new Error("This tool is only available for MongoDB");
            }
            const mongoAdapter = this.adapter as any;
            const { collection, filter, update } = args as {
              collection: string;
              filter: any;
              update: any;
            };
            const modified = await mongoAdapter.updateMany(collection, filter, update);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ collection, filter, update, modified_count: modified }, null, 2),
                },
              ],
            };
          }

          case "mongo_delete_one": {
            this.checkReadOnly();
            if (!this.isMongo) {
              throw new Error("This tool is only available for MongoDB");
            }
            const mongoAdapter = this.adapter as any;
            const { collection, filter } = args as {
              collection: string;
              filter: any;
            };
            const deleted = await mongoAdapter.deleteOne(collection, filter);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ collection, filter, deleted_count: deleted }, null, 2),
                },
              ],
            };
          }

          case "mongo_delete_many": {
            this.checkReadOnly();
            if (!this.isMongo) {
              throw new Error("This tool is only available for MongoDB");
            }
            const mongoAdapter = this.adapter as any;
            const { collection, filter } = args as {
              collection: string;
              filter: any;
            };
            const deleted = await mongoAdapter.deleteMany(collection, filter);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ collection, filter, deleted_count: deleted }, null, 2),
                },
              ],
            };
          }

          case "mongo_count": {
            if (!this.isMongo) {
              throw new Error("This tool is only available for MongoDB");
            }
            const mongoAdapter = this.adapter as any;
            const { collection, filter = {} } = args as {
              collection: string;
              filter?: any;
            };
            const count = await mongoAdapter.count(collection, filter);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ collection, filter, count }, null, 2),
                },
              ],
            };
          }

          case "mongo_aggregate": {
            if (!this.isMongo) {
              throw new Error("This tool is only available for MongoDB");
            }
            const mongoAdapter = this.adapter as any;
            const { collection, pipeline } = args as {
              collection: string;
              pipeline: any[];
            };
            const results = await mongoAdapter.aggregate(collection, pipeline);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ collection, pipeline, results, count: results.length }, null, 2),
                },
              ],
            };
          }

          case "mongo_list_collections": {
            if (!this.isMongo) {
              throw new Error("This tool is only available for MongoDB");
            }
            const mongoAdapter = this.adapter as any;
            const collections = await mongoAdapter.listCollections();
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ collections, count: collections.length }, null, 2),
                },
              ],
            };
          }

          case "mongo_get_collection_stats": {
            if (!this.isMongo) {
              throw new Error("This tool is only available for MongoDB");
            }
            const mongoAdapter = this.adapter as any;
            const { collection } = args as { collection: string };
            const stats = await mongoAdapter.getCollectionStats(collection);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(stats, null, 2),
                },
              ],
            };
          }

          case "mongo_get_indexes": {
            if (!this.isMongo) {
              throw new Error("This tool is only available for MongoDB");
            }
            const mongoAdapter = this.adapter as any;
            const { collection } = args as { collection: string };
            const indexes = await (mongoAdapter as any).getIndexesForCollection(collection);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ collection, indexes }, null, 2),
                },
              ],
            };
          }

          case "mongo_create_index": {
            this.checkReadOnly();
            if (!this.isMongo) {
              throw new Error("This tool is only available for MongoDB");
            }
            const mongoAdapter = this.adapter as any;
            const { collection, keys, options = {} } = args as {
              collection: string;
              keys: any;
              options?: any;
            };
            const indexName = await mongoAdapter.createIndex(collection, keys, options);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ collection, keys, options, index_name: indexName }, null, 2),
                },
              ],
            };
          }

          case "mongo_get_database_stats": {
            if (!this.isMongo) {
              throw new Error("This tool is only available for MongoDB");
            }
            const mongoAdapter = this.adapter as any;
            const stats = await mongoAdapter.getDatabaseStats();
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(stats, null, 2),
                },
              ],
            };
          }

          // LDAP-specific tools
          case "ldap_search": {
            if (!this.isLDAP) {
              throw new Error("This tool is only available for LDAP");
            }
            const ldapAdapter = this.adapter as any;
            const { base, filter, scope = "sub", attributes = ["*"] } = args as {
              base: string;
              filter: string;
              scope?: "base" | "one" | "sub";
              attributes?: string[];
            };
            const entries = await ldapAdapter.search(base, filter, { scope, attributes });
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ base, filter, scope, attributes, entries, count: entries.length }, null, 2),
                },
              ],
            };
          }

          case "ldap_authenticate": {
            if (!this.isLDAP) {
              throw new Error("This tool is only available for LDAP");
            }
            const ldapAdapter = this.adapter as any;
            const { dn, password } = args as { dn: string; password: string };
            const authenticated = await ldapAdapter.authenticate(dn, password);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ dn, authenticated }, null, 2),
                },
              ],
            };
          }

          case "ldap_add": {
            this.checkReadOnly();
            if (!this.isLDAP) {
              throw new Error("This tool is only available for LDAP");
            }
            const ldapAdapter = this.adapter as any;
            const { dn, attributes } = args as {
              dn: string;
              attributes: Record<string, string | string[]>;
            };
            await ldapAdapter.add(dn, attributes);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ dn, attributes, status: "OK" }, null, 2),
                },
              ],
            };
          }

          case "ldap_modify": {
            this.checkReadOnly();
            if (!this.isLDAP) {
              throw new Error("This tool is only available for LDAP");
            }
            const ldapAdapter = this.adapter as any;
            const { dn, change } = args as { dn: string; change: any };
            await ldapAdapter.modify(dn, change);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ dn, change, status: "OK" }, null, 2),
                },
              ],
            };
          }

          case "ldap_delete": {
            this.checkReadOnly();
            if (!this.isLDAP) {
              throw new Error("This tool is only available for LDAP");
            }
            const ldapAdapter = this.adapter as any;
            const { dn } = args as { dn: string };
            await ldapAdapter.delete(dn);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ dn, status: "OK" }, null, 2),
                },
              ],
            };
          }

          case "ldap_compare": {
            if (!this.isLDAP) {
              throw new Error("This tool is only available for LDAP");
            }
            const ldapAdapter = this.adapter as any;
            const { dn, attribute, value } = args as {
              dn: string;
              attribute: string;
              value: string;
            };
            const matched = await ldapAdapter.compare(dn, attribute, value);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ dn, attribute, value, matched }, null, 2),
                },
              ],
            };
          }

          case "ldap_search_folder_structure": {
            if (!this.isLDAP) {
              throw new Error("This tool is only available for LDAP");
            }
            const ldapAdapter = this.adapter as any;
            const { base = "", depth = 10, include_entries = false } = args as {
              base?: string;
              depth?: number;
              include_entries?: boolean;
            };
            const structure = await ldapAdapter.searchFolderStructure(base, depth, include_entries);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(structure, null, 2),
                },
              ],
            };
          }

          case "ldap_list_folders": {
            if (!this.isLDAP) {
              throw new Error("This tool is only available for LDAP");
            }
            const ldapAdapter = this.adapter as any;
            const { base = "" } = args as { base?: string };
            const folders = await ldapAdapter.listFolders(base);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ base: base || "root", folders, count: folders.length }, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Database MCP server running on stdio");
  }
}

