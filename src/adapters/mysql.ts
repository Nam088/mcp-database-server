import { createPool, Pool, PoolOptions } from "mysql2/promise";
import {
  DatabaseAdapter,
  QueryResult,
  ExecuteResult,
  TableSchema,
  FieldInfo,
  ExplainResult,
  IndexInfo,
  ForeignKeyInfo,
  TableSizeInfo,
  ViewInfo,
  TableStats,
} from "./base.js";

// MySQL adapter implementation
export class MySQLAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;
  private defaultDatabase: string = "";

  constructor(connectionString: string) {
    // Parse connection string or use connection options
    const config = this.parseConnectionString(connectionString);
    
    this.pool = createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  private parseConnectionString(connectionString: string): PoolOptions {
    try {
      const url = new URL(connectionString);
      const config: PoolOptions = {
        host: url.hostname,
        port: parseInt(url.port || "3306", 10),
        user: url.username || undefined,
        password: url.password || undefined,
        database: url.pathname.slice(1) || undefined,
      };
      
      if (config.database) {
        this.defaultDatabase = config.database;
      }
      
      return config;
    } catch {
      // If not a valid URL, try to parse as key=value format
      const config: PoolOptions = {};
      const parts = connectionString.split(";");
      for (const part of parts) {
        const [key, value] = part.split("=").map(s => s.trim());
        if (key && value) {
          switch (key.toLowerCase()) {
            case "host":
            case "server":
              config.host = value;
              break;
            case "port":
              config.port = parseInt(value, 10);
              break;
            case "user":
            case "uid":
            case "username":
              config.user = value;
              break;
            case "password":
            case "pwd":
              config.password = value;
              break;
            case "database":
            case "db":
            case "databasename":
              config.database = value;
              this.defaultDatabase = value;
              break;
          }
        }
      }
      return config;
    }
  }

  async query(sql: string): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error("Database connection not initialized");
    }

    const [rows, fields] = await this.pool.execute(sql);
    return {
      rows: rows as any[],
      rowCount: Array.isArray(rows) ? rows.length : 0,
      fields: (fields || []).map((f: any) => ({
        name: f.name,
        dataTypeID: f.type,
        dataType: this.getDataTypeName(f.type),
      })),
    };
  }

  async execute(sql: string, params?: any[]): Promise<ExecuteResult> {
    if (!this.pool) {
      throw new Error("Database connection not initialized");
    }

    const [result] = await this.pool.execute(sql, params);
    const rows = result as any[];
    const command = sql.trim().split(/\s+/)[0].toUpperCase();
    
    return {
      command,
      rowCount: Array.isArray(rows) ? rows.length : (result as any).affectedRows || 0,
      rows: Array.isArray(rows) ? rows : undefined,
    };
  }

  private getDataTypeName(type: number): string {
    // MySQL type constants mapping (simplified)
    const typeMap: Record<number, string> = {
      0: "DECIMAL",
      1: "TINY",
      2: "SHORT",
      3: "LONG",
      4: "FLOAT",
      5: "DOUBLE",
      6: "NULL",
      7: "TIMESTAMP",
      8: "LONGLONG",
      9: "INT24",
      10: "DATE",
      11: "TIME",
      12: "DATETIME",
      13: "YEAR",
      14: "NEWDATE",
      15: "VARCHAR",
      16: "BIT",
      245: "JSON",
      246: "NEWDECIMAL",
      247: "ENUM",
      248: "SET",
      249: "TINY_BLOB",
      250: "MEDIUM_BLOB",
      251: "LONG_BLOB",
      252: "BLOB",
      253: "VAR_STRING",
      254: "STRING",
      255: "GEOMETRY",
    };
    return typeMap[type] || "UNKNOWN";
  }

  async listTables(schema?: string): Promise<string[]> {
    const dbName = schema || this.defaultDatabase;
    const query = dbName
      ? `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name`
      : `SHOW TABLES`;
    
    const result = dbName
      ? await this.execute(query, [dbName])
      : await this.execute(query);
    
    const key = dbName ? "table_name" : `Tables_in_${this.defaultDatabase || "database"}`;
    return (result.rows || []).map((row: any) => row[key] || Object.values(row)[0]);
  }

  async describeTable(table: string, schema?: string): Promise<TableSchema> {
    const dbName = schema || this.defaultDatabase;
    const query = `
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = ? AND table_name = ?
      ORDER BY ordinal_position
    `;
    const result = await this.execute(query, [dbName, table]);
    return {
      table,
      schema: dbName || "",
      columns: (result.rows || []) as any[],
    };
  }

  async listSchemas(): Promise<string[]> {
    const query = `SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys') ORDER BY schema_name`;
    const result = await this.execute(query);
    return (result.rows || []).map((row: any) => row.schema_name);
  }

  async explainQuery(sql: string): Promise<ExplainResult> {
    const explainSql = `EXPLAIN ${sql}`;
    const result = await this.query(explainSql);
    return {
      plan: result.rows,
      query: sql,
    };
  }

  async getIndexes(table: string, schema?: string): Promise<IndexInfo[]> {
    const dbName = schema || this.defaultDatabase;
    const query = `
      SELECT
        s.index_name,
        s.index_type,
        s.non_unique = 0 AS is_unique,
        GROUP_CONCAT(s.column_name ORDER BY s.seq_in_index) AS columns
      FROM information_schema.statistics s
      WHERE s.table_schema = ? AND s.table_name = ?
      GROUP BY s.index_name, s.index_type, s.non_unique
      ORDER BY s.index_name
    `;
    const result = await this.execute(query, [dbName, table]);
    return (result.rows || []).map((row: any) => ({
      index_name: row.index_name,
      index_type: row.index_type,
      is_unique: Boolean(row.is_unique),
      columns: row.columns ? row.columns.split(",") : [],
    }));
  }

  async getForeignKeys(table: string, schema?: string): Promise<ForeignKeyInfo[]> {
    const dbName = schema || this.defaultDatabase;
    const query = `
      SELECT
        k.constraint_name,
        k.column_name,
        k.referenced_table_schema AS foreign_table_schema,
        k.referenced_table_name AS foreign_table_name,
        k.referenced_column_name AS foreign_column_name
      FROM information_schema.key_column_usage k
      WHERE k.table_schema = ? 
        AND k.table_name = ?
        AND k.referenced_table_name IS NOT NULL
    `;
    const result = await this.execute(query, [dbName, table]);
    return (result.rows || []).map((row: any) => ({
      constraint_name: row.constraint_name,
      column_name: row.column_name,
      foreign_table_schema: row.foreign_table_schema,
      foreign_table_name: row.foreign_table_name,
      foreign_column_name: row.foreign_column_name,
    }));
  }

  async getTableSize(table: string, schema?: string): Promise<TableSizeInfo> {
    const dbName = schema || this.defaultDatabase;
    const query = `
      SELECT
        table_name AS table,
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb,
        (data_length + index_length) AS size_bytes,
        table_rows AS rows
      FROM information_schema.tables
      WHERE table_schema = ? AND table_name = ?
    `;
    const result = await this.execute(query, [dbName, table]);
    const row = result.rows?.[0];
    return {
      table,
      schema: dbName || "",
      size: row?.size_mb ? `${row.size_mb} MB` : "0 bytes",
      size_bytes: parseInt(row?.size_bytes || "0", 10),
      rows: parseInt(row?.rows || "0", 10),
    };
  }

  async listViews(schema?: string): Promise<string[]> {
    const dbName = schema || this.defaultDatabase;
    const query = `
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = ?
      ORDER BY table_name
    `;
    const result = await this.execute(query, [dbName]);
    return (result.rows || []).map((row: any) => row.table_name);
  }

  async describeView(view: string, schema?: string): Promise<ViewInfo> {
    const dbName = schema || this.defaultDatabase;
    const query = `
      SELECT view_definition
      FROM information_schema.views
      WHERE table_schema = ? AND table_name = ?
    `;
    const result = await this.execute(query, [dbName, view]);
    return {
      view,
      schema: dbName || "",
      definition: result.rows?.[0]?.view_definition || "",
    };
  }

  async searchTables(pattern: string, schema?: string): Promise<string[]> {
    const dbName = schema || this.defaultDatabase;
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ? 
        AND table_type = 'BASE TABLE'
        AND table_name LIKE ?
      ORDER BY table_name
    `;
    const result = await this.execute(query, [dbName, `%${pattern}%`]);
    return (result.rows || []).map((row: any) => row.table_name);
  }

  async getTableStats(table: string, schema?: string): Promise<TableStats> {
    const dbName = schema || this.defaultDatabase;
    const query = `
      SELECT
        table_rows AS row_count,
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS total_size_mb,
        ROUND((data_length / 1024 / 1024), 2) AS table_size_mb,
        ROUND((index_length / 1024 / 1024), 2) AS indexes_size_mb
      FROM information_schema.tables
      WHERE table_schema = ? AND table_name = ?
    `;
    const result = await this.execute(query, [dbName, table]);
    const row = result.rows?.[0];
    return {
      table,
      schema: dbName || "",
      row_count: parseInt(row?.row_count || "0", 10),
      total_size: row?.total_size_mb ? `${row.total_size_mb} MB` : "0 bytes",
      table_size: row?.table_size_mb ? `${row.table_size_mb} MB` : "0 bytes",
      indexes_size: row?.indexes_size_mb ? `${row.indexes_size_mb} MB` : "0 bytes",
    };
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

