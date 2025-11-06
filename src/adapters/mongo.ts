import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import { DatabaseAdapter } from "./base.js";

// MongoDB adapter implementation
export class MongoAdapter implements DatabaseAdapter {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private databaseName: string = "";

  constructor(connectionString: string) {
    this.client = new MongoClient(connectionString);
    // Extract database name from connection string
    const url = new URL(connectionString);
    this.databaseName = url.pathname.substring(1) || "test";
  }

  async connect(): Promise<void> {
    if (!this.client) {
      throw new Error("MongoDB client not initialized");
    }
    await this.client.connect();
    this.db = this.client.db(this.databaseName);
  }

  // MongoDB-specific methods
  async find(collection: string, filter: any = {}, limit: number = 100, skip: number = 0): Promise<any[]> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    const coll = this.db.collection(collection);
    return await coll.find(filter).limit(limit).skip(skip).toArray();
  }

  async findOne(collection: string, filter: any = {}): Promise<any | null> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    const coll = this.db.collection(collection);
    return await coll.findOne(filter);
  }

  async insertOne(collection: string, document: any): Promise<string> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    const coll = this.db.collection(collection);
    const result = await coll.insertOne(document);
    return result.insertedId.toString();
  }

  async insertMany(collection: string, documents: any[]): Promise<string[]> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    const coll = this.db.collection(collection);
    const result = await coll.insertMany(documents);
    return Object.values(result.insertedIds).map((id) => id.toString());
  }

  async updateOne(collection: string, filter: any, update: any): Promise<number> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    const coll = this.db.collection(collection);
    const result = await coll.updateOne(filter, { $set: update });
    return result.modifiedCount;
  }

  async updateMany(collection: string, filter: any, update: any): Promise<number> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    const coll = this.db.collection(collection);
    const result = await coll.updateMany(filter, { $set: update });
    return result.modifiedCount;
  }

  async deleteOne(collection: string, filter: any): Promise<number> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    const coll = this.db.collection(collection);
    const result = await coll.deleteOne(filter);
    return result.deletedCount;
  }

  async deleteMany(collection: string, filter: any): Promise<number> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    const coll = this.db.collection(collection);
    const result = await coll.deleteMany(filter);
    return result.deletedCount;
  }

  async count(collection: string, filter: any = {}): Promise<number> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    const coll = this.db.collection(collection);
    return await coll.countDocuments(filter);
  }

  async aggregate(collection: string, pipeline: any[]): Promise<any[]> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    const coll = this.db.collection(collection);
    return await coll.aggregate(pipeline).toArray();
  }

  async listCollections(): Promise<string[]> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    const collections = await this.db.listCollections().toArray();
    return collections.map((col) => col.name);
  }

  async getCollectionStats(collection: string): Promise<any> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    const stats = await this.db.command({ collStats: collection });
    return {
      collection,
      count: stats.count || 0,
      size: stats.size || 0,
      storageSize: stats.storageSize || 0,
      indexes: stats.nindexes || 0,
      indexSize: stats.totalIndexSize || 0,
    };
  }

  async getIndexesForCollection(collection: string): Promise<any[]> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    const coll = this.db.collection(collection);
    const indexes = await coll.indexes();
    return indexes.map((idx: any) => ({
      name: idx.name,
      keys: idx.key,
      unique: idx.unique || false,
    }));
  }

  async createIndex(collection: string, keys: any, options: any = {}): Promise<string> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    const coll = this.db.collection(collection);
    return await coll.createIndex(keys, options);
  }

  async dropIndex(collection: string, indexName: string): Promise<void> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    const coll = this.db.collection(collection);
    await coll.dropIndex(indexName);
  }

  async getDatabaseStats(): Promise<any> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    const stats = await this.db.stats();
    return {
      database: this.databaseName,
      collections: stats.collections || 0,
      dataSize: stats.dataSize || 0,
      storageSize: stats.storageSize || 0,
      indexes: stats.indexes || 0,
      indexSize: stats.indexSize || 0,
    };
  }

  // DatabaseAdapter interface implementation (for compatibility)
  async query(sql: string): Promise<any> {
    throw new Error("MongoDB does not support SQL queries. Use MongoDB-specific methods instead.");
  }

  async execute(sql: string, params?: any[]): Promise<any> {
    throw new Error("MongoDB does not support SQL execution. Use MongoDB-specific methods instead.");
  }

  async listTables(schema?: string): Promise<string[]> {
    // In MongoDB, collections are like tables
    return await this.listCollections();
  }

  async describeTable(table: string, schema?: string): Promise<any> {
    // In MongoDB, we can describe a collection by getting sample documents
    const sample = await this.findOne(table, {});
    const stats = await this.getCollectionStats(table);
    const indexes = await this.getIndexesForCollection(table);
    
    // Infer schema from sample document
    let schemaInfo: any = {};
    if (sample) {
      for (const [key, value] of Object.entries(sample)) {
        schemaInfo[key] = typeof value;
      }
    }

    return {
      collection: table,
      schema: schemaInfo,
      stats,
      indexes,
    };
  }

  async listSchemas(): Promise<string[]> {
    // MongoDB doesn't have schemas in the SQL sense, return database name
    return [this.databaseName];
  }

  async explainQuery(sql: string): Promise<any> {
    throw new Error("MongoDB does not support EXPLAIN queries in SQL format.");
  }

  async getIndexes(table: string, schema?: string): Promise<any[]> {
    // This is the DatabaseAdapter interface method, delegate to MongoDB-specific method
    return await this.getIndexesForCollection(table);
  }

  async getForeignKeys(table: string, schema?: string): Promise<any[]> {
    // MongoDB doesn't have foreign keys in the SQL sense
    return [];
  }

  async getTableSize(table: string, schema?: string): Promise<any> {
    const stats = await this.getCollectionStats(table);
    return {
      collection: table,
      size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
      size_bytes: stats.size,
      rows: stats.count,
    };
  }

  async listViews(schema?: string): Promise<string[]> {
    // MongoDB doesn't have views in the SQL sense
    return [];
  }

  async describeView(view: string, schema?: string): Promise<any> {
    throw new Error("MongoDB does not support views.");
  }

  async searchTables(pattern: string, schema?: string): Promise<string[]> {
    const collections = await this.listCollections();
    const regex = new RegExp(pattern, "i");
    return collections.filter((col) => regex.test(col));
  }

  async getTableStats(table: string, schema?: string): Promise<any> {
    const stats = await this.getCollectionStats(table);
    return {
      collection: table,
      row_count: stats.count,
      total_size: `${((stats.size + stats.indexSize) / 1024 / 1024).toFixed(2)} MB`,
      table_size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
      indexes_size: `${(stats.indexSize / 1024 / 1024).toFixed(2)} MB`,
    };
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }
}

