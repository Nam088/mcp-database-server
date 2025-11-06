import Database from "better-sqlite3";
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

// SQLite adapter implementation
export class SQLiteAdapter implements DatabaseAdapter {
  private db: Database.Database | null = null;

  constructor(connectionString: string) {
    // SQLite connection string is just a file path
    // Support formats: sqlite://path/to/db.sqlite, sqlite:path/to/db.sqlite, or just path/to/db.sqlite
    let dbPath = connectionString;
    
    if (connectionString.startsWith("sqlite://")) {
      dbPath = connectionString.replace("sqlite://", "");
    } else if (connectionString.startsWith("sqlite:")) {
      dbPath = connectionString.replace("sqlite:", "");
    }
    
    // Remove leading slash if it's a file:// protocol
    if (dbPath.startsWith("file://")) {
      dbPath = dbPath.replace("file://", "");
    }
    
    this.db = new Database(dbPath, {
      readonly: process.env.READ_ONLY_MODE === "true" || process.env.READ_ONLY_MODE !== "false",
    });
  }

  async query(sql: string): Promise<QueryResult> {
    if (!this.db) {
      throw new Error("Database connection not initialized");
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all() as any[];
    
    // Get column info from the first row or from the statement
    const info = stmt.columns();
    const fields: FieldInfo[] = info.map((col: any) => ({
      name: col.name,
      dataType: col.type || "TEXT",
    }));

    return {
      rows,
      rowCount: rows.length,
      fields,
    };
  }

  async execute(sql: string, params?: any[]): Promise<ExecuteResult> {
    if (!this.db) {
      throw new Error("Database connection not initialized");
    }

    const stmt = this.db.prepare(sql);
    const command = sql.trim().split(/\s+/)[0].toUpperCase();
    
    if (params && params.length > 0) {
      const result = stmt.run(...params);
      return {
        command,
        rowCount: result.changes || 0,
        rows: undefined,
      };
    } else {
      const result = stmt.run();
      return {
        command,
        rowCount: result.changes || 0,
        rows: undefined,
      };
    }
  }

  async listTables(schema?: string): Promise<string[]> {
    if (!this.db) {
      throw new Error("Database connection not initialized");
    }

    const query = `
      SELECT name 
      FROM sqlite_master 
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `;
    const stmt = this.db.prepare(query);
    const rows = stmt.all() as any[];
    return rows.map((row: any) => row.name);
  }

  async describeTable(table: string, schema?: string): Promise<TableSchema> {
    if (!this.db) {
      throw new Error("Database connection not initialized");
    }

    // Get table schema from sqlite_master
    const schemaQuery = `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`;
    const schemaStmt = this.db.prepare(schemaQuery);
    const schemaRow = schemaStmt.get(table) as any;
    
    // Get column info using PRAGMA
    const pragmaStmt = this.db.prepare(`PRAGMA table_info(?)`);
    const columns = pragmaStmt.all(table) as any[];
    
    const columnInfo = columns.map((col: any) => ({
      column_name: col.name,
      data_type: col.type || "TEXT",
      character_maximum_length: null,
      is_nullable: col.notnull === 0 ? "YES" : "NO",
      column_default: col.dflt_value || null,
    }));

    return {
      table,
      schema: schema || "main",
      columns: columnInfo,
    };
  }

  async listSchemas(): Promise<string[]> {
    // SQLite doesn't have schemas in the traditional sense, but it has attached databases
    if (!this.db) {
      throw new Error("Database connection not initialized");
    }

    const query = `PRAGMA database_list`;
    const stmt = this.db.prepare(query);
    const rows = stmt.all() as any[];
    return rows.map((row: any) => row.name || "main");
  }

  async explainQuery(sql: string): Promise<ExplainResult> {
    if (!this.db) {
      throw new Error("Database connection not initialized");
    }

    const explainSql = `EXPLAIN QUERY PLAN ${sql}`;
    const stmt = this.db.prepare(explainSql);
    const rows = stmt.all() as any[];
    
    return {
      plan: rows,
      query: sql,
    };
  }

  async getIndexes(table: string, schema?: string): Promise<IndexInfo[]> {
    if (!this.db) {
      throw new Error("Database connection not initialized");
    }

    const query = `
      SELECT 
        name AS index_name,
        CASE WHEN "unique" = 1 THEN 'UNIQUE' ELSE 'BTREE' END AS index_type,
        "unique" = 1 AS is_unique
      FROM sqlite_master
      WHERE type = 'index' 
        AND tbl_name = ?
        AND name NOT LIKE 'sqlite_%'
    `;
    const stmt = this.db.prepare(query);
    const indexes = stmt.all(table) as any[];
    
    // Get columns for each index
    const result: IndexInfo[] = [];
    for (const idx of indexes) {
      const indexInfoQuery = `PRAGMA index_info(?)`;
      const indexInfoStmt = this.db.prepare(indexInfoQuery);
      const columns = indexInfoStmt.all(idx.index_name) as any[];
      
      result.push({
        index_name: idx.index_name,
        index_type: idx.index_type,
        is_unique: Boolean(idx.is_unique),
        columns: columns.map((col: any) => col.name),
      });
    }
    
    return result;
  }

  async getForeignKeys(table: string, schema?: string): Promise<ForeignKeyInfo[]> {
    if (!this.db) {
      throw new Error("Database connection not initialized");
    }

    const query = `PRAGMA foreign_key_list(?)`;
    const stmt = this.db.prepare(query);
    const rows = stmt.all(table) as any[];
    
    return rows.map((row: any) => ({
      constraint_name: `fk_${table}_${row.from}`,
      column_name: row.from,
      foreign_table_schema: "",
      foreign_table_name: row.table || "",
      foreign_column_name: row.to || "",
    }));
  }

  async getTableSize(table: string, schema?: string): Promise<TableSizeInfo> {
    if (!this.db) {
      throw new Error("Database connection not initialized");
    }

    // SQLite doesn't have a direct way to get table size, but we can get page count
    try {
      const countQuery = `SELECT COUNT(*) AS rows FROM ${this.escapeIdentifier(table)}`;
      const countStmt = this.db.prepare(countQuery);
      const countRow = countStmt.get() as any;
      
      // Get database page size
      const pageSizeStmt = this.db.prepare(`PRAGMA page_size`);
      const pageSizeRow = pageSizeStmt.get() as any;
      const pageSize = pageSizeRow?.page_size || 4096;
      
      // Get page count for the table (approximate)
      const pageCountStmt = this.db.prepare(`PRAGMA page_count`);
      const pageCountRow = pageCountStmt.get() as any;
      const pageCount = pageCountRow?.page_count || 0;
      const sizeBytes = pageCount * pageSize;
      
      return {
        table,
        schema: schema || "main",
        size: this.formatBytes(sizeBytes),
        size_bytes: sizeBytes,
        rows: parseInt(countRow?.rows || "0", 10),
      };
    } catch {
      // Fallback if query fails
      const countQuery = `SELECT COUNT(*) AS rows FROM ${this.escapeIdentifier(table)}`;
      const countStmt = this.db.prepare(countQuery);
      const countRow = countStmt.get() as any;
      
      return {
        table,
        schema: schema || "main",
        size: "0 bytes",
        size_bytes: 0,
        rows: parseInt(countRow?.rows || "0", 10),
      };
    }
  }

  async listViews(schema?: string): Promise<string[]> {
    if (!this.db) {
      throw new Error("Database connection not initialized");
    }

    const query = `
      SELECT name 
      FROM sqlite_master 
      WHERE type = 'view'
      ORDER BY name
    `;
    const stmt = this.db.prepare(query);
    const rows = stmt.all() as any[];
    return rows.map((row: any) => row.name);
  }

  async describeView(view: string, schema?: string): Promise<ViewInfo> {
    if (!this.db) {
      throw new Error("Database connection not initialized");
    }

    const query = `SELECT sql FROM sqlite_master WHERE type = 'view' AND name = ?`;
    const stmt = this.db.prepare(query);
    const row = stmt.get(view) as any;
    
    return {
      view,
      schema: schema || "main",
      definition: row?.sql || "",
    };
  }

  async searchTables(pattern: string, schema?: string): Promise<string[]> {
    if (!this.db) {
      throw new Error("Database connection not initialized");
    }

    const query = `
      SELECT name 
      FROM sqlite_master 
      WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
        AND name LIKE ?
      ORDER BY name
    `;
    const stmt = this.db.prepare(query);
    const rows = stmt.all(`%${pattern}%`) as any[];
    return rows.map((row: any) => row.name);
  }

  async getTableStats(table: string, schema?: string): Promise<TableStats> {
    if (!this.db) {
      throw new Error("Database connection not initialized");
    }

    const countQuery = `SELECT COUNT(*) AS row_count FROM ${this.escapeIdentifier(table)}`;
    const countStmt = this.db.prepare(countQuery);
    const countRow = countStmt.get() as any;
    
    const sizeInfo = await this.getTableSize(table, schema);
    
    return {
      table,
      schema: schema || "main",
      row_count: parseInt(countRow?.row_count || "0", 10),
      total_size: sizeInfo.size,
      table_size: sizeInfo.size,
      indexes_size: "0 bytes",
    };
  }

  private escapeIdentifier(identifier: string): string {
    // Simple escaping for SQLite identifiers
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 bytes";
    const k = 1024;
    const sizes = ["bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

