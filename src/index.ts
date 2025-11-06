#!/usr/bin/env node

import { DatabaseMCPServer } from "./server.js";
import type { DatabaseAdapter } from "./adapters/base.js";

// Get database type from environment variable
const dbType = process.env.DB_TYPE || "postgres";

// Get connection string from environment
let connectionString: string;
if (dbType.toLowerCase() === "redis") {
  connectionString =
    process.env.REDIS_CONNECTION_STRING ||
    process.env.REDIS_URL ||
    "redis://localhost:6379";
} else if (dbType.toLowerCase() === "mongodb" || dbType.toLowerCase() === "mongo") {
  connectionString =
    process.env.MONGODB_CONNECTION_STRING ||
    process.env.MONGODB_URL ||
    "mongodb://localhost:27017";
} else if (dbType.toLowerCase() === "ldap") {
  connectionString =
    process.env.LDAP_CONNECTION_STRING ||
    process.env.LDAP_URL ||
    "ldap://localhost:389";
} else if (dbType.toLowerCase() === "mysql" || dbType.toLowerCase() === "mysql2") {
  connectionString =
    process.env.MYSQL_CONNECTION_STRING ||
    process.env.MYSQL_URL ||
    process.env.DATABASE_URL ||
    "mysql://localhost:3306";
} else if (dbType.toLowerCase() === "sqlite") {
  connectionString =
    process.env.SQLITE_CONNECTION_STRING ||
    process.env.SQLITE_URL ||
    process.env.DATABASE_URL ||
    "sqlite://./database.sqlite";
} else {
  connectionString =
    process.env.POSTGRES_CONNECTION_STRING ||
    process.env.DATABASE_URL ||
    "postgresql://localhost:5432/postgres";
}

// Initialize adapter based on database type (lazy import to avoid loading unused dependencies)
async function createAdapter(): Promise<DatabaseAdapter> {
  switch (dbType.toLowerCase()) {
    case "postgres":
    case "postgresql": {
      const { PostgresAdapter } = await import("./adapters/postgres.js");
      return new PostgresAdapter(connectionString);
    }
    case "redis": {
      const { RedisAdapter } = await import("./adapters/redis.js");
      const redisAdapter = new RedisAdapter(connectionString);
      await redisAdapter.connect();
      return redisAdapter;
    }
    case "mongodb":
    case "mongo": {
      const { MongoAdapter } = await import("./adapters/mongo.js");
      const mongoAdapter = new MongoAdapter(connectionString);
      await mongoAdapter.connect();
      return mongoAdapter;
    }
    case "ldap": {
      const { LDAPAdapter } = await import("./adapters/ldap.js");
      const ldapAdapter = new LDAPAdapter(connectionString);
      
      // Support multiple ways to specify bind credentials
      let bindDN = process.env.LDAP_BIND_DN;
      const bindPassword = process.env.LDAP_PASSWORD || process.env.LDAP_BIND_PASSWORD;
      
      // If LDAP_BIND_DN is not set, try to construct it from LDAP_LOGIN and LDAP_BASE_DN
      if (!bindDN) {
        const login = process.env.LDAP_LOGIN;
        const baseDN = process.env.LDAP_BASE_DN;
        const rootDomain = process.env.LDAP_ROOT_DOMAIN;
        
        if (login && baseDN) {
          // Try multiple formats for Active Directory compatibility
          // Order matters: try most common formats first
          const bindDNFormats = [
            `CN=${login},CN=Users,${baseDN}`,            // CN=username,CN=Users,DC=domain,DC=com (most common for AD)
            `${login}@${rootDomain || baseDN.replace(/DC=/g, '').replace(/,/g, '.').replace(/DC\./g, '')}`, // UPN format: username@domain.com
            `CN=${login},${baseDN}`,                    // CN=username,DC=domain,DC=com
            `CN=${login},OU=Users,${baseDN}`,            // CN=username,OU=Users,DC=domain,DC=com
            login,                                       // Simple bind with sAMAccountName
          ];
          
          // Try each format until one works
          let connected = false;
          let lastError: any = null;
          
          for (const format of bindDNFormats) {
            if (format && bindPassword) {
              try {
                await ldapAdapter.connect(format, bindPassword);
                connected = true;
                bindDN = format;
                console.log(`✅ LDAP bind successful with format: ${format}`);
                break;
              } catch (error: any) {
                lastError = error;
                // Continue to next format
                console.warn(`⚠️  Failed to bind with format "${format}": ${error.message || error}`);
              }
            }
          }
          
          // If none worked, throw error with helpful message
          if (!connected) {
            throw new Error(
              `LDAP bind failed with all attempted formats. Last error: ${lastError?.message || lastError}. ` +
              `Tried formats: ${bindDNFormats.filter(f => f).join(', ')}. ` +
              `Please check credentials or set LDAP_BIND_DN explicitly.`
            );
          }
        } else if (login && rootDomain) {
          // Try UPN format: login@domain
          bindDN = `${login}@${rootDomain}`;
          if (bindPassword) {
            await ldapAdapter.connect(bindDN, bindPassword);
          }
        } else if (login) {
          // Fallback to just login (simple bind)
          bindDN = login;
          if (bindPassword) {
            await ldapAdapter.connect(bindDN, bindPassword);
          }
        }
      } else if (bindDN && bindPassword) {
        // Use explicitly provided bind DN
        await ldapAdapter.connect(bindDN, bindPassword);
      }
      
      // If no credentials provided, allow anonymous bind (read-only operations)
      // This is useful for public LDAP servers
      
      return ldapAdapter;
    }
    case "mysql":
    case "mysql2": {
      const { MySQLAdapter } = await import("./adapters/mysql.js");
      return new MySQLAdapter(connectionString);
    }
    case "sqlite": {
      const { SQLiteAdapter } = await import("./adapters/sqlite.js");
      return new SQLiteAdapter(connectionString);
    }
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
}

// Start server
async function main() {
  try {
    const adapter = await createAdapter();
    const server = new DatabaseMCPServer(adapter);
    await server.start();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
