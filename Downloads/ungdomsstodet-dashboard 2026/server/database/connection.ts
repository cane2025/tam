/**
 * Database Connection Manager
 * Handles SQLite connection with proper configuration
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path
export const DB_PATH = process.env.DB_PATH || join(__dirname, '..', '..', 'data', 'ungdomsstod.db');

// Database instance
let db: Database.Database | null = null;

/**
 * Get database connection (singleton pattern)
 */
export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    
    // Configure database
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000'); // 64MB cache
    db.pragma('temp_store = MEMORY');
  }
  
  return db;
}

/**
 * Get database connection (alias for backward compatibility)
 */
export const getDb = getDatabase;

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Initialize database connection
 */
export function initDatabase(): void {
  try {
    const database = getDatabase();
    
    // Test connection
    const result = database.prepare('SELECT 1 as test').get() as { test: number };
    if (result.test !== 1) {
      throw new Error('Database connection test failed');
    }
    
    console.log('✅ Database connected successfully');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

/**
 * Database transaction helper
 */
export function transaction<T>(callback: (db: Database.Database) => T): T {
  const database = getDatabase();
  return database.transaction(callback)(database);
}

/**
 * Safe query execution with error handling
 */
export function safeQuery<T>(
  query: string,
  params: any[] = []
): T[] {
  try {
    const database = getDatabase();
    const stmt = database.prepare(query);
    return stmt.all(params) as T[];
  } catch (error) {
    console.error('Query error:', error);
    console.error('Query:', query);
    console.error('Params:', params);
    throw error;
  }
}

/**
 * Safe query execution for single row
 */
export function safeQueryOne<T>(
  query: string,
  params: any[] = []
): T | null {
  try {
    const database = getDatabase();
    const stmt = database.prepare(query);
    return stmt.get(params) as T | null;
  } catch (error) {
    console.error('Query error:', error);
    console.error('Query:', query);
    console.error('Params:', params);
    throw error;
  }
}

/**
 * Safe query execution for insert/update/delete
 */
export function safeExecute(
  query: string,
  params: any[] = []
): Database.RunResult {
  try {
    const database = getDatabase();
    const stmt = database.prepare(query);
    return stmt.run(params);
  } catch (error) {
    console.error('Execute error:', error);
    console.error('Query:', query);
    console.error('Params:', params);
    throw error;
  }
}

