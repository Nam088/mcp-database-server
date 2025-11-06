#!/usr/bin/env node

import { LDAPAdapter } from "./adapters/ldap.js";
import { MongoAdapter } from "./adapters/mongo.js";
import { PostgresAdapter } from "./adapters/postgres.js";
import { RedisAdapter } from "./adapters/redis.js";
import { DatabaseMCPServer } from "./server.js";

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
} else {
  connectionString =
    process.env.POSTGRES_CONNECTION_STRING ||
    process.env.DATABASE_URL ||
    "postgresql://localhost:5432/postgres";
}

// Initialize adapter based on database type
async function createAdapter() {
  switch (dbType.toLowerCase()) {
    case "postgres":
    case "postgresql":
      return new PostgresAdapter(connectionString);
    case "redis":
      const redisAdapter = new RedisAdapter(connectionString);
      await redisAdapter.connect();
      return redisAdapter;
    case "mongodb":
    case "mongo":
      const mongoAdapter = new MongoAdapter(connectionString);
      await mongoAdapter.connect();
      return mongoAdapter;
    case "ldap":
      const ldapAdapter = new LDAPAdapter(connectionString);
      const bindDN = process.env.LDAP_BIND_DN;
      const bindPassword = process.env.LDAP_BIND_PASSWORD;
      if (bindDN && bindPassword) {
        await ldapAdapter.connect(bindDN, bindPassword);
      }
      return ldapAdapter;
    // Future: Add MySQL, etc.
    // case "mysql":
    //   return new MySQLAdapter(connectionString);
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
