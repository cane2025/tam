#!/usr/bin/env tsx

/**
 * Database Migration Script
 * Executes SQL schema and handles database setup
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', 'data', 'ungdomsstod.db');

import { mkdirSync } from 'fs';

function ensureDataDir(): void {
  const dataDir = join(__dirname, '..', 'data');
  try {
    mkdirSync(dataDir, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

function migrate(): void {
  console.log('🚀 Starting database migration...');
  
  try {
    ensureDataDir();
    
    // Read schema file
    const schemaPath = join(__dirname, '..', 'server', 'database', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    // Create database connection
    const db = new Database(DB_PATH);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Execute schema
    console.log('📝 Executing schema...');
    const statements = schema.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          db.exec(statement);
        } catch (error) {
          console.warn(`⚠️  Warning executing statement: ${error}`);
        }
      }
    }
    
    // Verify tables were created
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as { name: string }[];
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 Created tables:', tables.map(t => t.name).join(', '));
    
    // Test connection
    const result = db.prepare('SELECT 1 as test').get() as { test: number };
    if (result.test === 1) {
      console.log('✅ Database connection test passed');
    }
    
    db.close();
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate();
}

export { migrate, DB_PATH };
