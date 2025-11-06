# @nam088/mcp-database-server

MCP (Model Context Protocol) server for multiple database types, designed with a modular architecture for easy extensibility.

> 📖 **Read in Vietnamese**: [README.vi.md](./README.vi.md)

## Features

The server provides the following tools:

- **query**: Execute SELECT queries and return results
- **execute_sql**: Execute any SQL command (INSERT, UPDATE, DELETE, CREATE, etc.)
- **list_tables**: List all tables in the database
- **describe_table**: Get detailed information about a table's schema

## Architecture

The project is split into separate modules:

```
src/
├── index.ts              # Entry point, initializes adapter based on DB_TYPE
├── server.ts             # MCP server implementation
└── adapters/
    ├── base.ts           # Base adapter interface
    ├── postgres.ts       # PostgreSQL adapter implementation
    ├── redis.ts          # Redis adapter implementation
    ├── mongo.ts          # MongoDB adapter implementation
    └── ldap.ts           # LDAP adapter implementation
```

### Database Adapters

Each database has its own adapter implementing the `DatabaseAdapter` interface:

- `PostgresAdapter`: PostgreSQL support with 13 SQL tools
- `RedisAdapter`: Redis support with 16 Redis tools
- `MongoAdapter`: MongoDB support with 15 MongoDB tools
- `LDAPAdapter`: LDAP support with 6 LDAP tools

## Installation

1. Install dependencies:

```bash
npm install
```

2. Build the project:

```bash
npm run build
```

## Configuration

### Environment Variables

- `DB_TYPE`: Database type (default: `postgres`)
  - `postgres` or `postgresql`: PostgreSQL
  - `redis`: Redis
  - `mongodb` or `mongo`: MongoDB
  - `ldap`: LDAP

- `READ_ONLY_MODE`: Read-only mode (default: `true` - safer)
  - `true` or not set: Only allows reads, blocks all write operations (default)
  - `false` or `0`: Allows both read and write (must be set explicitly)

- `POSTGRES_CONNECTION_STRING`: Connection string for PostgreSQL
- `REDIS_CONNECTION_STRING` or `REDIS_URL`: Connection string for Redis
- `MONGODB_CONNECTION_STRING` or `MONGODB_URL`: Connection string for MongoDB
- `LDAP_CONNECTION_STRING` or `LDAP_URL`: Connection string for LDAP
- `LDAP_BIND_DN`: Bind DN for LDAP authentication (optional)
- `LDAP_BIND_PASSWORD`: Bind password for LDAP authentication (optional)
- `DATABASE_URL`: Connection string (fallback for PostgreSQL)

Examples:

```bash
# PostgreSQL with read-only mode (default, no need to set READ_ONLY_MODE)
export DB_TYPE="postgres"
export POSTGRES_CONNECTION_STRING="postgresql://user:password@localhost:5432/mydb"
# READ_ONLY_MODE defaults to true

# Redis with write access (must be set explicitly)
export DB_TYPE="redis"
export REDIS_CONNECTION_STRING="redis://localhost:6379"
export READ_ONLY_MODE="false"

# MongoDB with read-only mode (default)
export DB_TYPE="mongodb"
export MONGODB_CONNECTION_STRING="mongodb://localhost:27017/mydb"
# READ_ONLY_MODE defaults to true
```

## Usage

### Using npx (Recommended)

After publishing, you can run the server directly with `npx` without installing:

```bash
npx @nam088/mcp-database-server
```

### Local Development

Run the server locally:

```bash
npm start
```

Or run in development mode with watch:

```bash
npm run dev
```

## MCP Client Configuration

Add the server to your MCP client configuration (e.g., Claude Desktop). You can use either `npx` (recommended) or `node` with a local path.

### Using npx (Recommended)

The easiest way is to use `npx`, which will automatically download and run the package:

```json
{
  "mcpServers": {
    "postgres-readonly": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "postgres",
        "POSTGRES_CONNECTION_STRING": "postgresql://user:password@localhost:5432/mydb"
      }
    }
  }
}
```

**Note**: The `-y` flag automatically accepts package installation if not already present.

### Using Local Installation

If you prefer to install locally or use a specific path:

```json
{
  "mcpServers": {
    "postgres-readonly": {
      "command": "node",
      "args": ["/path/to/database-server/dist/index.js"],
      "env": {
        "DB_TYPE": "postgres",
        "POSTGRES_CONNECTION_STRING": "postgresql://user:password@localhost:5432/mydb"
      }
    }
  }
}
```

### PostgreSQL

#### Read-Only Mode (Default) with npx

**No need to set `READ_ONLY_MODE` as this is the default**:

```json
{
  "mcpServers": {
    "postgres-readonly": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "postgres",
        "POSTGRES_CONNECTION_STRING": "postgresql://user:password@localhost:5432/mydb"
      }
    }
  }
}
```

#### Read-Write Mode with npx

**Note**: You must explicitly set `READ_ONLY_MODE` to `"false"` to allow write operations.

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "postgres",
        "POSTGRES_CONNECTION_STRING": "postgresql://user:password@localhost:5432/mydb",
        "READ_ONLY_MODE": "false"
      }
    }
  }
}
```

#### With DATABASE_URL using npx

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "postgres",
        "DATABASE_URL": "postgresql://user:password@localhost:5432/mydb"
      }
    }
  }
}
```

### Redis

#### Read-Only Mode with npx

```json
{
  "mcpServers": {
    "redis-readonly": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "redis",
        "REDIS_CONNECTION_STRING": "redis://localhost:6379",
        "READ_ONLY_MODE": "true"
      }
    }
  }
}
```

#### Read-Write Mode with npx

**Note**: You must explicitly set `READ_ONLY_MODE` to `"false"` to allow write operations.

```json
{
  "mcpServers": {
    "redis": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "redis",
        "REDIS_CONNECTION_STRING": "redis://localhost:6379",
        "READ_ONLY_MODE": "false"
      }
    }
  }
}
```

#### With REDIS_URL and password using npx

```json
{
  "mcpServers": {
    "redis": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "redis",
        "REDIS_URL": "redis://:password@localhost:6379/0"
      }
    }
  }
}
```

#### Redis with SSL/TLS using npx

```json
{
  "mcpServers": {
    "redis": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "redis",
        "REDIS_CONNECTION_STRING": "rediss://user:password@redis.example.com:6380"
      }
    }
  }
}
```

### MongoDB

#### Read-Only Mode with npx

```json
{
  "mcpServers": {
    "mongodb-readonly": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "mongodb",
        "MONGODB_CONNECTION_STRING": "mongodb://localhost:27017/mydb",
        "READ_ONLY_MODE": "true"
      }
    }
  }
}
```

#### Read-Write Mode with npx

**Note**: You must explicitly set `READ_ONLY_MODE` to `"false"` to allow write operations.

```json
{
  "mcpServers": {
    "mongodb": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "mongodb",
        "MONGODB_CONNECTION_STRING": "mongodb://localhost:27017/mydb",
        "READ_ONLY_MODE": "false"
      }
    }
  }
}
```

#### MongoDB with authentication using npx

```json
{
  "mcpServers": {
    "mongodb": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "mongodb",
        "MONGODB_CONNECTION_STRING": "mongodb://username:password@localhost:27017/mydb?authSource=admin"
      }
    }
  }
}
```

#### MongoDB with replica set using npx

```json
{
  "mcpServers": {
    "mongodb": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "mongodb",
        "MONGODB_CONNECTION_STRING": "mongodb://host1:27017,host2:27017,host3:27017/mydb?replicaSet=myReplicaSet"
      }
    }
  }
}
```

#### MongoDB Atlas (Cloud) using npx

```json
{
  "mcpServers": {
    "mongodb-atlas": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "mongodb",
        "MONGODB_CONNECTION_STRING": "mongodb+srv://username:password@cluster.mongodb.net/mydb?retryWrites=true&w=majority"
      }
    }
  }
}
```

### LDAP

**Note**: The project uses `ldapts` instead of `ldapjs` (which has been decommissioned) to ensure sustainability and better support.

#### Read-Only Mode (Default) with npx

**No need to set `READ_ONLY_MODE` as this is the default**:

```json
{
  "mcpServers": {
    "ldap-readonly": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "ldap",
        "LDAP_CONNECTION_STRING": "ldap://localhost:389"
      }
    }
  }
}
```

#### Read-Write Mode with npx

**Note**: You must explicitly set `READ_ONLY_MODE` to `"false"` to allow write operations.

```json
{
  "mcpServers": {
    "ldap": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "ldap",
        "LDAP_CONNECTION_STRING": "ldap://localhost:389",
        "READ_ONLY_MODE": "false"
      }
    }
  }
}
```

#### LDAP with authentication using npx

```json
{
  "mcpServers": {
    "ldap": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "ldap",
        "LDAP_CONNECTION_STRING": "ldap://localhost:389",
        "LDAP_BIND_DN": "cn=admin,dc=example,dc=com",
        "LDAP_BIND_PASSWORD": "password123"
      }
    }
  }
}
```

#### LDAP with LDAPS (SSL/TLS) using npx

```json
{
  "mcpServers": {
    "ldap": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "ldap",
        "LDAP_CONNECTION_STRING": "ldaps://ldap.example.com:636"
      }
    }
  }
}
```

#### Active Directory (Microsoft) using npx

```json
{
  "mcpServers": {
    "ldap-ad": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "ldap",
        "LDAP_CONNECTION_STRING": "ldap://ad.example.com:389",
        "LDAP_BIND_DN": "CN=Service Account,CN=Users,DC=example,DC=com",
        "LDAP_BIND_PASSWORD": "password123"
      }
    }
  }
}
```

### Configuring Multiple Databases with npx

You can configure multiple databases in the same MCP client:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "postgres",
        "POSTGRES_CONNECTION_STRING": "postgresql://user:password@localhost:5432/mydb",
        "READ_ONLY_MODE": "true"
      }
    },
    "redis": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "redis",
        "REDIS_CONNECTION_STRING": "redis://localhost:6379",
        "READ_ONLY_MODE": "false"
      }
    },
    "mongodb": {
      "command": "npx",
      "args": ["-y", "@nam088/mcp-database-server"],
      "env": {
        "DB_TYPE": "mongodb",
        "MONGODB_CONNECTION_STRING": "mongodb://localhost:27017/mydb"
      }
    }
  }
}
```

## Read-Only Mode

**⚠️ By default, the server runs in read-only mode** to protect data from accidental deletion or modification. When `READ_ONLY_MODE` is `true` or not set (default), the server will block all write operations:

**PostgreSQL:**
- ✅ Allowed: `query` (SELECT)
- ❌ Blocked: `execute_sql` (INSERT, UPDATE, DELETE, CREATE, etc.)

**Redis:**
- ✅ Allowed: `redis_get`, `redis_keys`, `redis_exists`, `redis_ttl`, `redis_type`, `redis_dbsize`, `redis_info`, `redis_hget`, `redis_hgetall`, `redis_lrange`, `redis_smembers`, `redis_zrange`
- ❌ Blocked: `redis_set`, `redis_del`, `redis_expire`, `redis_hset`

**MongoDB:**
- ✅ Allowed: `mongo_find`, `mongo_find_one`, `mongo_count`, `mongo_aggregate`, `mongo_list_collections`, `mongo_get_collection_stats`, `mongo_get_indexes`, `mongo_get_database_stats`
- ❌ Blocked: `mongo_insert_one`, `mongo_insert_many`, `mongo_update_one`, `mongo_update_many`, `mongo_delete_one`, `mongo_delete_many`, `mongo_create_index`

**LDAP:**
- ✅ Allowed: `ldap_search`, `ldap_authenticate`, `ldap_compare`
- ❌ Blocked: `ldap_add`, `ldap_modify`, `ldap_delete`

When attempting to execute a write operation in read-only mode, the server will return an error:
```
Error: Server is running in read-only mode. Write operations are disabled.
```

## Adding a New Database Adapter

To add support for a new database:

1. Create a new adapter file in `src/adapters/` (e.g., `mysql.ts`)
2. Implement the `DatabaseAdapter` interface from `base.ts`
3. Add a new case in `src/index.ts` to initialize the adapter

Example:

```typescript
// src/adapters/mysql.ts
import { DatabaseAdapter, QueryResult, ExecuteResult, TableSchema } from "./base.js";

export class MySQLAdapter implements DatabaseAdapter {
  // Implement methods from DatabaseAdapter
  async query(sql: string): Promise<QueryResult> { ... }
  async execute(sql: string, params?: any[]): Promise<ExecuteResult> { ... }
  async listTables(schema?: string): Promise<string[]> { ... }
  async describeTable(table: string, schema?: string): Promise<TableSchema> { ... }
}
```

Then add to `src/index.ts`:

```typescript
case "mysql":
  return new MySQLAdapter(connectionString);
```

## Tools

### query

Execute a SELECT query:

```json
{
  "name": "query",
  "arguments": {
    "sql": "SELECT * FROM users LIMIT 10"
  }
}
```

### execute_sql

Execute a SQL command:

```json
{
  "name": "execute_sql",
  "arguments": {
    "sql": "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')"
  }
}
```

### list_tables

List tables:

```json
{
  "name": "list_tables",
  "arguments": {
    "schema": "public"
  }
}
```

### describe_table

Describe table schema:

```json
{
  "name": "describe_table",
  "arguments": {
    "table": "users",
    "schema": "public"
  }
}
```

## License

MIT
