# @nam088/mcp-database-server

MCP (Model Context Protocol) server cho nhiều loại database, được thiết kế với kiến trúc modular để dễ dàng mở rộng.

> 📖 **Read in English**: [README.md](./README.md)

## Tính năng

Server cung cấp các tools sau:

- **query**: Thực thi SELECT queries và trả về kết quả
- **execute_sql**: Thực thi bất kỳ SQL command nào (INSERT, UPDATE, DELETE, CREATE, etc.)
- **list_tables**: Liệt kê tất cả các tables trong database
- **describe_table**: Lấy thông tin chi tiết về schema của một table

## Kiến trúc

Project được tách thành các module riêng biệt:

```
src/
├── index.ts              # Entry point, khởi tạo adapter dựa trên DB_TYPE
├── server.ts             # MCP server implementation
└── adapters/
    ├── base.ts           # Base adapter interface
    ├── postgres.ts       # PostgreSQL adapter implementation
    ├── redis.ts          # Redis adapter implementation
    ├── mongo.ts          # MongoDB adapter implementation
    └── ldap.ts           # LDAP adapter implementation
```

### Database Adapters

Mỗi database có adapter riêng implement interface `DatabaseAdapter`:

- `PostgresAdapter`: PostgreSQL support với 13 SQL tools
- `RedisAdapter`: Redis support với 16 Redis tools
- `MongoAdapter`: MongoDB support với 15 MongoDB tools
- `LDAPAdapter`: LDAP support với 6 LDAP tools

## Cài đặt

1. Cài đặt dependencies:

```bash
npm install
```

2. Build project:

```bash
npm run build
```

## Cấu hình

### Biến môi trường

- `DB_TYPE`: Loại database (mặc định: `postgres`)
  - `postgres` hoặc `postgresql`: PostgreSQL
  - `redis`: Redis
  - `mongodb` hoặc `mongo`: MongoDB
  - `ldap`: LDAP

- `READ_ONLY_MODE`: Chế độ read-only (mặc định: `true` - an toàn hơn)
  - `true` hoặc không set: Chỉ cho phép đọc, chặn tất cả write operations (mặc định)
  - `false` hoặc `0`: Cho phép cả read và write (phải set explicitly)

- `POSTGRES_CONNECTION_STRING`: Connection string cho PostgreSQL
- `REDIS_CONNECTION_STRING` hoặc `REDIS_URL`: Connection string cho Redis
- `MONGODB_CONNECTION_STRING` hoặc `MONGODB_URL`: Connection string cho MongoDB
- `LDAP_CONNECTION_STRING` hoặc `LDAP_URL`: Connection string cho LDAP
- `LDAP_BIND_DN`: Bind DN cho LDAP authentication (optional)
- `LDAP_BIND_PASSWORD`: Bind password cho LDAP authentication (optional)
- `DATABASE_URL`: Connection string (fallback cho PostgreSQL)

Ví dụ:

```bash
# PostgreSQL với read-only mode (mặc định, không cần set READ_ONLY_MODE)
export DB_TYPE="postgres"
export POSTGRES_CONNECTION_STRING="postgresql://user:password@localhost:5432/mydb"
# READ_ONLY_MODE mặc định là true

# Redis với write access (phải set explicitly)
export DB_TYPE="redis"
export REDIS_CONNECTION_STRING="redis://localhost:6379"
export READ_ONLY_MODE="false"

# MongoDB với read-only mode (mặc định)
export DB_TYPE="mongodb"
export MONGODB_CONNECTION_STRING="mongodb://localhost:27017/mydb"
# READ_ONLY_MODE mặc định là true
```

## Sử dụng

### Sử dụng npx (Khuyến nghị)

Sau khi publish, bạn có thể chạy server trực tiếp với `npx` mà không cần cài đặt:

```bash
npx @nam088/mcp-database-server
```

### Phát triển Local

Chạy server local:

```bash
npm start
```

Hoặc chạy ở chế độ development với watch:

```bash
npm run dev
```

## Cấu hình MCP Client

Thêm server vào cấu hình MCP client của bạn (ví dụ: Claude Desktop). Bạn có thể sử dụng `npx` (khuyến nghị) hoặc `node` với đường dẫn local.

### Sử dụng npx (Khuyến nghị)

Cách dễ nhất là sử dụng `npx`, sẽ tự động download và chạy package:

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

**Lưu ý**: Flag `-y` sẽ tự động đồng ý cài đặt package nếu chưa có.

### Sử dụng Local Installation

Nếu bạn muốn cài đặt local hoặc sử dụng đường dẫn cụ thể:

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

#### Read-Only Mode (Mặc định) với npx

**Không cần set `READ_ONLY_MODE` vì đây là mặc định**:

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

#### Read-Write Mode với npx

**Lưu ý**: Bạn phải set `READ_ONLY_MODE` thành `"false"` một cách rõ ràng để cho phép write operations.

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

#### Với DATABASE_URL sử dụng npx

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

#### Read-Only Mode với npx

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

#### Read-Write Mode với npx

**Lưu ý**: Bạn phải set `READ_ONLY_MODE` thành `"false"` một cách rõ ràng để cho phép write operations.

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

#### Với REDIS_URL và password sử dụng npx

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

#### Redis với SSL/TLS sử dụng npx

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

#### Read-Only Mode với npx

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

#### Read-Write Mode với npx

**Lưu ý**: Bạn phải set `READ_ONLY_MODE` thành `"false"` một cách rõ ràng để cho phép write operations.

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

#### MongoDB với authentication sử dụng npx

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

#### MongoDB với replica set sử dụng npx

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

#### MongoDB Atlas (Cloud) sử dụng npx

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

**Lưu ý**: Project sử dụng `ldapts` thay vì `ldapjs` (đã bị decomissioned) để đảm bảo tính bền vững và hỗ trợ tốt hơn.

#### Read-Only Mode (Mặc định) với npx

**Không cần set `READ_ONLY_MODE` vì đây là mặc định**:

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

#### Read-Write Mode với npx

**Lưu ý**: Bạn phải set `READ_ONLY_MODE` thành `"false"` một cách rõ ràng để cho phép write operations.

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

#### LDAP với authentication sử dụng npx

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

#### LDAP với LDAPS (SSL/TLS) sử dụng npx

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

#### Active Directory (Microsoft) sử dụng npx

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

### Cấu hình nhiều databases cùng lúc với npx

Bạn có thể cấu hình nhiều databases trong cùng một MCP client:

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

**⚠️ Mặc định, server chạy ở chế độ read-only** để bảo vệ dữ liệu khỏi việc xóa hoặc sửa đổi nhầm. Khi `READ_ONLY_MODE` là `true` hoặc không được set (mặc định), server sẽ chặn tất cả các write operations:

**PostgreSQL:**
- ✅ Cho phép: `query` (SELECT)
- ❌ Chặn: `execute_sql` (INSERT, UPDATE, DELETE, CREATE, etc.)

**Redis:**
- ✅ Cho phép: `redis_get`, `redis_keys`, `redis_exists`, `redis_ttl`, `redis_type`, `redis_dbsize`, `redis_info`, `redis_hget`, `redis_hgetall`, `redis_lrange`, `redis_smembers`, `redis_zrange`
- ❌ Chặn: `redis_set`, `redis_del`, `redis_expire`, `redis_hset`

**MongoDB:**
- ✅ Cho phép: `mongo_find`, `mongo_find_one`, `mongo_count`, `mongo_aggregate`, `mongo_list_collections`, `mongo_get_collection_stats`, `mongo_get_indexes`, `mongo_get_database_stats`
- ❌ Chặn: `mongo_insert_one`, `mongo_insert_many`, `mongo_update_one`, `mongo_update_many`, `mongo_delete_one`, `mongo_delete_many`, `mongo_create_index`

**LDAP:**
- ✅ Cho phép: `ldap_search`, `ldap_authenticate`, `ldap_compare`
- ❌ Chặn: `ldap_add`, `ldap_modify`, `ldap_delete`

Khi cố gắng thực thi write operation trong read-only mode, server sẽ trả về lỗi:
```
Error: Server is running in read-only mode. Write operations are disabled.
```

## Thêm Database Adapter mới

Để thêm support cho database mới:

1. Tạo file adapter mới trong `src/adapters/` (ví dụ: `mysql.ts`)
2. Implement interface `DatabaseAdapter` từ `base.ts`
3. Thêm case mới trong `src/index.ts` để khởi tạo adapter

Ví dụ:

```typescript
// src/adapters/mysql.ts
import { DatabaseAdapter, QueryResult, ExecuteResult, TableSchema } from "./base.js";

export class MySQLAdapter implements DatabaseAdapter {
  // Implement các methods từ DatabaseAdapter
  async query(sql: string): Promise<QueryResult> { ... }
  async execute(sql: string, params?: any[]): Promise<ExecuteResult> { ... }
  async listTables(schema?: string): Promise<string[]> { ... }
  async describeTable(table: string, schema?: string): Promise<TableSchema> { ... }
}
```

Sau đó thêm vào `src/index.ts`:

```typescript
case "mysql":
  return new MySQLAdapter(connectionString);
```

## Tools

### query

Thực thi SELECT query:

```json
{
  "name": "query",
  "arguments": {
    "sql": "SELECT * FROM users LIMIT 10"
  }
}
```

### execute_sql

Thực thi SQL command:

```json
{
  "name": "execute_sql",
  "arguments": {
    "sql": "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')"
  }
}
```

### list_tables

Liệt kê tables:

```json
{
  "name": "list_tables",
  "arguments": {
    "schema": "public"
  }
}
```

### describe_table

Mô tả table schema:

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

