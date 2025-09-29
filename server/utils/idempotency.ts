/**
 * Idempotency Utilities
 * Ensures safe API operations with idempotency keys
 */

import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, safeQueryOne, safeExecute } from '../database/connection.js';
import type { IdempotencyKey } from '../types/database.js';
import type { Request, Response, NextFunction } from 'express';

const IDEMPOTENCY_KEY_EXPIRY_HOURS = 24;

/**
 * Generate idempotency key
 */
export function generateIdempotencyKey(): string {
  return `idem_${uuidv4()}`;
}

/**
 * Generate request hash for idempotency
 */
export function generateRequestHash(requestBody: Record<string, unknown>, userId?: string): string {
  const data = {
    body: requestBody,
    userId: userId || 'anonymous',
    timestamp: new Date().toISOString()
  };
  
  return createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}

/**
 * Check if idempotency key exists and is valid
 */
export function checkIdempotencyKey(key: string): IdempotencyKey | null {
  const query = `
    SELECT * FROM idempotency_keys 
    WHERE key = ? AND expires_at > datetime('now')
  `;
  
  return safeQueryOne<IdempotencyKey>(query, [key]);
}

/**
 * Store idempotency key with response
 */
export function storeIdempotencyKey(
  key: string,
  operation: string,
  requestHash: string,
  response: Record<string, unknown>
): void {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_KEY_EXPIRY_HOURS);
  
  const query = `
    INSERT OR REPLACE INTO idempotency_keys 
    (key, operation, request_hash, response, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  safeExecute(query, [
    key,
    operation,
    requestHash,
    JSON.stringify(response),
    expiresAt.toISOString()
  ]);
}

/**
 * Store idempotency key without response (for pending operations)
 */
export function storePendingIdempotencyKey(
  key: string,
  operation: string,
  requestHash: string
): void {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_KEY_EXPIRY_HOURS);
  
  const query = `
    INSERT OR REPLACE INTO idempotency_keys 
    (key, operation, request_hash, response, expires_at)
    VALUES (?, ?, ?, NULL, ?)
  `;
  
  safeExecute(query, [
    key,
    operation,
    requestHash,
    expiresAt.toISOString()
  ]);
}

/**
 * Complete idempotency key with response
 */
export function completeIdempotencyKey(key: string, response: Record<string, unknown>): void {
  const query = `
    UPDATE idempotency_keys 
    SET response = ?
    WHERE key = ?
  `;
  
  safeExecute(query, [JSON.stringify(response), key]);
}

/**
 * Clean up expired idempotency keys
 */
export function cleanupExpiredIdempotencyKeys(): void {
  const query = `
    DELETE FROM idempotency_keys 
    WHERE expires_at <= datetime('now')
  `;
  
  const result = safeExecute(query);
  if (result.changes > 0) {
    console.log(`🧹 Cleaned up ${result.changes} expired idempotency keys`);
  }
}

/**
 * Middleware for Express to handle idempotency
 */
export function idempotencyMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    
    if (!idempotencyKey) {
      return next();
    }
    
    // Generate request hash
    const requestHash = generateRequestHash(req.body, (req.user as { userId?: string })?.userId);
    
    // Check if key exists
    const existing = checkIdempotencyKey(idempotencyKey);
    
    if (existing) {
      if (existing.response) {
        // Return cached response
        try {
          const cachedResponse = JSON.parse(existing.response);
          return res.json(cachedResponse);
        } catch (error) {
          console.error('Failed to parse cached response:', error);
        }
      } else {
        // Operation is pending, return 409 Conflict
        return res.status(409).json({
          success: false,
          error: 'Operation already in progress',
          message: 'This operation is already being processed'
        });
      }
    }
    
    // Store pending operation
    storePendingIdempotencyKey(
      idempotencyKey,
      `${req.method} ${req.path}`,
      requestHash
    );
    
    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function(data: unknown) {
      completeIdempotencyKey(idempotencyKey, data as Record<string, unknown>);
      return originalJson(data);
    };
    
    next();
  };
}

/**
 * Generate idempotency key from request
 */
export function generateKeyFromRequest(req: Request): string {
  const { method, path, body, user } = req;
  
  // Create a deterministic key based on request content
  const keyData = {
    method,
    path,
    body,
    userId: (user as { userId?: string })?.userId
  };
  
  const hash = createHash('sha256')
    .update(JSON.stringify(keyData))
    .digest('hex');
  
  return `req_${hash.substring(0, 16)}`;
}

/**
 * Validate idempotency key format
 */
export function isValidIdempotencyKey(key: string): boolean {
  return /^[a-zA-Z0-9_-]{8,64}$/.test(key);
}

/**
 * Get idempotency statistics
 */
export function getIdempotencyStats(): {
  total: number;
  expired: number;
  pending: number;
  completed: number;
} {
  const db = getDatabase();
  
  const total = db.prepare(`
    SELECT COUNT(*) as count FROM idempotency_keys
  `).get() as { count: number };
  
  const expired = db.prepare(`
    SELECT COUNT(*) as count FROM idempotency_keys 
    WHERE expires_at <= datetime('now')
  `).get() as { count: number };
  
  const pending = db.prepare(`
    SELECT COUNT(*) as count FROM idempotency_keys 
    WHERE response IS NULL AND expires_at > datetime('now')
  `).get() as { count: number };
  
  const completed = db.prepare(`
    SELECT COUNT(*) as count FROM idempotency_keys 
    WHERE response IS NOT NULL AND expires_at > datetime('now')
  `).get() as { count: number };
  
  return {
    total: total.count,
    expired: expired.count,
    pending: pending.count,
    completed: completed.count
  };
}

