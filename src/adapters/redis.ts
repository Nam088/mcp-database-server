import { createClient, RedisClientType } from "redis";
import { DatabaseAdapter } from "./base.js";

// Redis adapter implementation
// Note: Redis has different operations than SQL databases
// This adapter implements a subset of DatabaseAdapter for compatibility
export class RedisAdapter implements DatabaseAdapter {
  private client: RedisClientType | null = null;

  constructor(connectionString: string) {
    this.client = createClient({
      url: connectionString,
    });

    this.client.on("error", (err: Error) => {
      console.error("Redis client error", err);
    });
  }

  async connect(): Promise<void> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    await this.client.connect();
  }

  // Redis-specific methods
  async get(key: string): Promise<string | null> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<number> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.del(key);
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.keys(pattern);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return (await this.client.exists(key)) > 0;
  }

  async ttl(key: string): Promise<number> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.ttl(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.expire(key, seconds);
  }

  async type(key: string): Promise<string> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.type(key);
  }

  async dbsize(): Promise<number> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.dbSize();
  }

  async info(section?: string): Promise<string> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.info(section);
  }

  // Hash operations
  async hget(key: string, field: string): Promise<string | null> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    const value = await this.client.hGet(key, field);
    return value ?? null;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.hSet(key, field, value);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.hGetAll(key);
  }

  async hdel(key: string, field: string): Promise<number> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.hDel(key, field);
  }

  // List operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.lPush(key, values);
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.rPush(key, values);
  }

  async lpop(key: string): Promise<string | null> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.lPop(key);
  }

  async rpop(key: string): Promise<string | null> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.rPop(key);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.lRange(key, start, stop);
  }

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.sAdd(key, members);
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.sMembers(key);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.sRem(key, members);
  }

  // Sorted set operations
  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return await this.client.zAdd(key, { score, value: member });
  }

  async zrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[] | any[]> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    if (withScores) {
      const result = await this.client.zRangeWithScores(key, start, stop);
      return result.map((item: any) => `${item.value}:${item.score}`);
    }
    return await this.client.zRange(key, start, stop);
  }

  // DatabaseAdapter interface implementation (for compatibility)
  // These methods are not really applicable to Redis but we implement them for interface compliance
  async query(sql: string): Promise<any> {
    throw new Error("Redis does not support SQL queries. Use Redis-specific methods instead.");
  }

  async execute(sql: string, params?: any[]): Promise<any> {
    throw new Error("Redis does not support SQL execution. Use Redis-specific methods instead.");
  }

  async listTables(schema?: string): Promise<string[]> {
    // In Redis, we can list all keys
    return await this.keys("*");
  }

  async describeTable(table: string, schema?: string): Promise<any> {
    // In Redis, we can describe a key
    const type = await this.type(table);
    const ttl = await this.ttl(table);
    const exists = await this.exists(table);
    
    let value: any = null;
    if (exists) {
      switch (type) {
        case "string":
          value = await this.get(table);
          break;
        case "hash":
          value = await this.hgetall(table);
          break;
        case "list":
          value = await this.lrange(table, 0, -1);
          break;
        case "set":
          value = await this.smembers(table);
          break;
        case "zset":
          value = await this.zrange(table, 0, -1, true);
          break;
      }
    }

    return {
      key: table,
      type,
      ttl,
      exists,
      value,
    };
  }

  async listSchemas(): Promise<string[]> {
    // Redis doesn't have schemas, return empty array
    return [];
  }

  async explainQuery(sql: string): Promise<any> {
    throw new Error("Redis does not support EXPLAIN queries.");
  }

  async getIndexes(table: string, schema?: string): Promise<any[]> {
    // Redis doesn't have indexes in the SQL sense
    return [];
  }

  async getForeignKeys(table: string, schema?: string): Promise<any[]> {
    // Redis doesn't have foreign keys
    return [];
  }

  async getTableSize(table: string, schema?: string): Promise<any> {
    // In Redis, we can get memory usage info
    const info = await this.info("memory");
    return {
      key: table,
      info,
    };
  }

  async listViews(schema?: string): Promise<string[]> {
    // Redis doesn't have views
    return [];
  }

  async describeView(view: string, schema?: string): Promise<any> {
    throw new Error("Redis does not support views.");
  }

  async searchTables(pattern: string, schema?: string): Promise<string[]> {
    return await this.keys(pattern);
  }

  async getTableStats(table: string, schema?: string): Promise<any> {
    const type = await this.type(table);
    const ttl = await this.ttl(table);
    const exists = await this.exists(table);
    
    return {
      key: table,
      type,
      ttl,
      exists,
    };
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}

