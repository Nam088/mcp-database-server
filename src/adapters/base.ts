// Base adapter interface for database operations
export interface DatabaseAdapter {
  // Execute a SELECT query
  query(sql: string): Promise<QueryResult>;

  // Execute any SQL command
  execute(sql: string, params?: any[]): Promise<ExecuteResult>;

  // List all tables in a schema
  listTables(schema?: string): Promise<string[]>;

  // Get table schema information
  describeTable(table: string, schema?: string): Promise<TableSchema>;

  // List all schemas
  listSchemas(): Promise<string[]>;

  // Explain query execution plan
  explainQuery(sql: string): Promise<ExplainResult>;

  // Get indexes for a table
  getIndexes(table: string, schema?: string): Promise<IndexInfo[]>;

  // Get foreign keys for a table
  getForeignKeys(table: string, schema?: string): Promise<ForeignKeyInfo[]>;

  // Get table size information
  getTableSize(table: string, schema?: string): Promise<TableSizeInfo>;

  // List all views in a schema
  listViews(schema?: string): Promise<string[]>;

  // Get view definition
  describeView(view: string, schema?: string): Promise<ViewInfo>;

  // Search tables by name pattern
  searchTables(pattern: string, schema?: string): Promise<string[]>;

  // Get table statistics
  getTableStats(table: string, schema?: string): Promise<TableStats>;
}

export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields: FieldInfo[];
}

export interface ExecuteResult {
  command: string;
  rowCount: number;
  rows?: any[];
}

export interface FieldInfo {
  name: string;
  dataTypeID?: number;
  dataType?: string;
}

export interface TableSchema {
  table: string;
  schema: string;
  columns: ColumnInfo[];
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  character_maximum_length?: number | null;
  is_nullable: string;
  column_default?: string | null;
}

export interface ExplainResult {
  plan: any[];
  query: string;
}

export interface IndexInfo {
  index_name: string;
  index_type: string;
  is_unique: boolean;
  columns: string[];
}

export interface ForeignKeyInfo {
  constraint_name: string;
  column_name: string;
  foreign_table_schema: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

export interface TableSizeInfo {
  table: string;
  schema: string;
  size: string;
  size_bytes: number;
  rows: number;
}

export interface ViewInfo {
  view: string;
  schema: string;
  definition: string;
}

export interface TableStats {
  table: string;
  schema: string;
  row_count: number;
  total_size: string;
  table_size: string;
  indexes_size: string;
}

