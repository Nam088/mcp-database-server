import { Pool } from "pg";
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

// PostgreSQL adapter implementation
export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on("error", (err: Error) => {
      console.error("Unexpected error on idle client", err);
    });
  }

  async query(sql: string): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error("Database connection not initialized");
    }

    const result = await this.pool.query(sql);
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
      fields: result.fields.map((f: any) => ({
        name: f.name,
        dataTypeID: f.dataTypeID,
      })),
    };
  }

  async execute(sql: string, params?: any[]): Promise<ExecuteResult> {
    if (!this.pool) {
      throw new Error("Database connection not initialized");
    }

    const result = await this.pool.query(sql, params);
    return {
      command: result.command || "",
      rowCount: result.rowCount || 0,
      rows: result.rows,
    };
  }

  async listTables(schema: string = "public"): Promise<string[]> {
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    const result = await this.execute(query, [schema]);
    return (result.rows || []).map((row: any) => row.table_name);
  }

  async describeTable(table: string, schema: string = "public"): Promise<TableSchema> {
    const query = `
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position;
    `;
    const result = await this.execute(query, [schema, table]);
    return {
      table,
      schema,
      columns: (result.rows || []) as any[],
    };
  }

  async listSchemas(): Promise<string[]> {
    const query = `
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name;
    `;
    const result = await this.execute(query);
    return (result.rows || []).map((row: any) => row.schema_name);
  }

  async explainQuery(sql: string): Promise<ExplainResult> {
    const explainSql = `EXPLAIN (FORMAT JSON) ${sql}`;
    const result = await this.query(explainSql);
    const plan = result.rows[0]?.["QUERY PLAN"] || result.rows[0] || result.rows;
    return {
      plan: Array.isArray(plan) ? plan : [plan],
      query: sql,
    };
  }

  async getIndexes(table: string, schema: string = "public"): Promise<IndexInfo[]> {
    const query = `
      SELECT
        i.relname AS index_name,
        am.amname AS index_type,
        ix.indisunique AS is_unique,
        array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_am am ON i.relam = am.oid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE n.nspname = $1 AND t.relname = $2
      GROUP BY i.relname, am.amname, ix.indisunique
      ORDER BY i.relname;
    `;
    const result = await this.execute(query, [schema, table]);
    return (result.rows || []).map((row: any) => ({
      index_name: row.index_name,
      index_type: row.index_type,
      is_unique: row.is_unique,
      columns: row.columns || [],
    }));
  }

  async getForeignKeys(table: string, schema: string = "public"): Promise<ForeignKeyInfo[]> {
    const query = `
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2;
    `;
    const result = await this.execute(query, [schema, table]);
    return (result.rows || []).map((row: any) => ({
      constraint_name: row.constraint_name,
      column_name: row.column_name,
      foreign_table_schema: row.foreign_table_schema,
      foreign_table_name: row.foreign_table_name,
      foreign_column_name: row.foreign_column_name,
    }));
  }

  async getTableSize(table: string, schema: string = "public"): Promise<TableSizeInfo> {
    const query = `
      SELECT
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes,
        n_live_tup AS rows
      FROM pg_stat_user_tables
      WHERE schemaname = $1 AND tablename = $2;
    `;
    const result = await this.execute(query, [schema, table]);
    const row = result.rows?.[0];
    return {
      table,
      schema,
      size: row?.size || "0 bytes",
      size_bytes: parseInt(row?.size_bytes || "0", 10),
      rows: parseInt(row?.rows || "0", 10),
    };
  }

  async listViews(schema: string = "public"): Promise<string[]> {
    const query = `
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = $1
      ORDER BY table_name;
    `;
    const result = await this.execute(query, [schema]);
    return (result.rows || []).map((row: any) => row.table_name);
  }

  async describeView(view: string, schema: string = "public"): Promise<ViewInfo> {
    const query = `
      SELECT view_definition
      FROM information_schema.views
      WHERE table_schema = $1 AND table_name = $2;
    `;
    const result = await this.execute(query, [schema, view]);
    return {
      view,
      schema,
      definition: result.rows?.[0]?.view_definition || "",
    };
  }

  async searchTables(pattern: string, schema: string = "public"): Promise<string[]> {
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1 
        AND table_type = 'BASE TABLE'
        AND table_name ILIKE $2
      ORDER BY table_name;
    `;
    const result = await this.execute(query, [schema, `%${pattern}%`]);
    return (result.rows || []).map((row: any) => row.table_name);
  }

  async getTableStats(table: string, schema: string = "public"): Promise<TableStats> {
    const query = `
      SELECT
        n_live_tup AS row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
      FROM pg_stat_user_tables
      WHERE schemaname = $1 AND tablename = $2;
    `;
    const result = await this.execute(query, [schema, table]);
    const row = result.rows?.[0];
    return {
      table,
      schema,
      row_count: parseInt(row?.row_count || "0", 10),
      total_size: row?.total_size || "0 bytes",
      table_size: row?.table_size || "0 bytes",
      indexes_size: row?.indexes_size || "0 bytes",
    };
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

