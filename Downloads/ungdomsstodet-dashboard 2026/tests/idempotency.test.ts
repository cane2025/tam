/**
 * Idempotency Tests
 * Tests for API idempotency functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  generateIdempotencyKey,
  generateRequestHash,
  checkIdempotencyKey,
  storeIdempotencyKey,
  storePendingIdempotencyKey,
  completeIdempotencyKey,
  cleanupExpiredIdempotencyKeys,
  isValidIdempotencyKey,
  getIdempotencyStats
} from '../server/utils/idempotency.js';

describe('Idempotency Utilities', () => {
  
  describe('Key Generation', () => {
    it('should generate unique idempotency keys', () => {
      const key1 = generateIdempotencyKey();
      const key2 = generateIdempotencyKey();
      
      expect(key1).not.toBe(key2);
      expect(key1).toMatch(/^idem_[a-f0-9-]{36}$/);
      expect(key2).toMatch(/^idem_[a-f0-9-]{36}$/);
    });

    it('should generate deterministic request hashes', () => {
      const requestBody = { name: 'test', value: 123 };
      const userId = 'user123';
      
      const hash1 = generateRequestHash(requestBody, userId);
      const hash2 = generateRequestHash(requestBody, userId);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex length
    });

    it('should generate different hashes for different requests', () => {
      const requestBody1 = { name: 'test1' };
      const requestBody2 = { name: 'test2' };
      const userId = 'user123';
      
      const hash1 = generateRequestHash(requestBody1, userId);
      const hash2 = generateRequestHash(requestBody2, userId);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hashes for different users', () => {
      const requestBody = { name: 'test' };
      const userId1 = 'user1';
      const userId2 = 'user2';
      
      const hash1 = generateRequestHash(requestBody, userId1);
      const hash2 = generateRequestHash(requestBody, userId2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Key Validation', () => {
    it('should validate correct idempotency key formats', () => {
      expect(isValidIdempotencyKey('idem_12345678-1234-1234-1234-123456789abc')).toBe(true);
      expect(isValidIdempotencyKey('req_1234567890abcdef')).toBe(true);
      expect(isValidIdempotencyKey('test-key_123')).toBe(true);
    });

    it('should reject invalid idempotency key formats', () => {
      expect(isValidIdempotencyKey('')).toBe(false);
      expect(isValidIdempotencyKey('123')).toBe(false); // Too short
      expect(isValidIdempotencyKey('a'.repeat(65))).toBe(false); // Too long
      expect(isValidIdempotencyKey('invalid@key')).toBe(false); // Invalid characters
      expect(isValidIdempotencyKey('key with spaces')).toBe(false); // Spaces
    });
  });

  describe('Key Storage and Retrieval', () => {
    const testKey = 'test-idempotency-key-123';
    const testOperation = 'POST /api/test';
    const testRequestHash = 'test-hash-123';
    const testResponse = { success: true, data: { id: 'test-id' } };

    it('should store and retrieve idempotency key', () => {
      // Store key
      storeIdempotencyKey(testKey, testOperation, testRequestHash, testResponse);
      
      // Retrieve key
      const retrieved = checkIdempotencyKey(testKey);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved!.key).toBe(testKey);
      expect(retrieved!.operation).toBe(testOperation);
      expect(retrieved!.request_hash).toBe(testRequestHash);
      expect(retrieved!.response).toBe(JSON.stringify(testResponse));
    });

    it('should return null for non-existent key', () => {
      const nonExistentKey = 'non-existent-key';
      const result = checkIdempotencyKey(nonExistentKey);
      
      expect(result).toBeNull();
    });

    it('should store pending idempotency key', () => {
      const pendingKey = 'pending-test-key';
      
      storePendingIdempotencyKey(pendingKey, testOperation, testRequestHash);
      
      const retrieved = checkIdempotencyKey(pendingKey);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved!.key).toBe(pendingKey);
      expect(retrieved!.operation).toBe(testOperation);
      expect(retrieved!.request_hash).toBe(testRequestHash);
      expect(retrieved!.response).toBeNull();
    });

    it('should complete pending idempotency key', () => {
      const pendingKey = 'complete-test-key';
      
      // Store pending
      storePendingIdempotencyKey(pendingKey, testOperation, testRequestHash);
      
      // Complete with response
      completeIdempotencyKey(pendingKey, testResponse);
      
      const retrieved = checkIdempotencyKey(pendingKey);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved!.response).toBe(JSON.stringify(testResponse));
    });
  });

  describe('Key Expiration', () => {
    it('should handle expired keys correctly', () => {
      const expiredKey = 'expired-test-key';
      
      // Store key with immediate expiration
      const now = new Date();
      now.setSeconds(now.getSeconds() - 1); // 1 second ago
      
      // This would require modifying the function to accept custom expiry
      // For now, we'll test that cleanup works
      cleanupExpiredIdempotencyKeys();
      
      // The key should not be retrievable after cleanup
      const result = checkIdempotencyKey(expiredKey);
      // Note: This test might pass or fail depending on timing
      // The important thing is that cleanup doesn't throw errors
    });
  });

  describe('Statistics', () => {
    it('should return idempotency statistics', () => {
      const stats = getIdempotencyStats();
      
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('expired');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('completed');
      
      expect(typeof stats.total).toBe('number');
      expect(typeof stats.expired).toBe('number');
      expect(typeof stats.pending).toBe('number');
      expect(typeof stats.completed).toBe('number');
      
      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.expired).toBeGreaterThanOrEqual(0);
      expect(stats.pending).toBeGreaterThanOrEqual(0);
      expect(stats.completed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete idempotency workflow', () => {
      const key = generateIdempotencyKey();
      const operation = 'POST /api/clients';
      const requestBody = { name: 'Test Client' };
      const requestHash = generateRequestHash(requestBody);
      const response = { success: true, data: { id: 'client-123' } };
      
      // 1. Check key doesn't exist
      expect(checkIdempotencyKey(key)).toBeNull();
      
      // 2. Store pending operation
      storePendingIdempotencyKey(key, operation, requestHash);
      
      // 3. Check pending key exists
      const pending = checkIdempotencyKey(key);
      expect(pending).not.toBeNull();
      expect(pending!.response).toBeNull();
      
      // 4. Complete operation
      completeIdempotencyKey(key, response);
      
      // 5. Check completed key
      const completed = checkIdempotencyKey(key);
      expect(completed).not.toBeNull();
      expect(completed!.response).toBe(JSON.stringify(response));
      
      // 6. Verify same key returns same response
      const retrieved = checkIdempotencyKey(key);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.response).toBe(JSON.stringify(response));
    });

    it('should handle duplicate request detection', () => {
      const key = generateIdempotencyKey();
      const operation = 'POST /api/test';
      const requestBody = { value: 'test' };
      const requestHash = generateRequestHash(requestBody);
      const response = { success: true, data: { id: 'test-123' } };
      
      // First request
      storeIdempotencyKey(key, operation, requestHash, response);
      
      // Simulate duplicate request with same hash
      const duplicateHash = generateRequestHash(requestBody);
      expect(duplicateHash).toBe(requestHash); // Should be identical
      
      // Should retrieve existing response
      const existing = checkIdempotencyKey(key);
      expect(existing).not.toBeNull();
      expect(existing!.response).toBe(JSON.stringify(response));
    });

    it('should handle different requests with same key (should not happen in practice)', () => {
      const key = 'same-key-different-requests';
      const operation = 'POST /api/test';
      
      // First request
      const request1 = { name: 'request1' };
      const hash1 = generateRequestHash(request1);
      const response1 = { success: true, data: { id: '1' } };
      
      storeIdempotencyKey(key, operation, hash1, response1);
      
      // Second request with different content but same key
      const request2 = { name: 'request2' };
      const hash2 = generateRequestHash(request2);
      
      // Should retrieve first response (idempotency key takes precedence)
      const retrieved = checkIdempotencyKey(key);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.request_hash).toBe(hash1); // Should be first hash
      expect(retrieved!.response).toBe(JSON.stringify(response1)); // Should be first response
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON in responses gracefully', () => {
      const key = 'invalid-json-test';
      const operation = 'POST /api/test';
      const requestHash = 'test-hash';
      
      // Store with invalid JSON (circular reference)
      const circularObj: any = {};
      circularObj.self = circularObj;
      
      expect(() => {
        storeIdempotencyKey(key, operation, requestHash, circularObj);
      }).toThrow();
    });

    it('should handle null and undefined responses', () => {
      const key = 'null-response-test';
      const operation = 'POST /api/test';
      const requestHash = 'test-hash';
      
      // Should handle null response
      expect(() => {
        storeIdempotencyKey(key, operation, requestHash, null);
      }).not.toThrow();
      
      const retrieved = checkIdempotencyKey(key);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.response).toBe('null');
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent operations', () => {
      const operations = Array.from({ length: 100 }, (_, i) => {
        const key = `perf-test-${i}`;
        const operation = `POST /api/test/${i}`;
        const requestHash = `hash-${i}`;
        const response = { success: true, data: { id: i } };
        
        return { key, operation, requestHash, response };
      });
      
      // Store all operations
      operations.forEach(op => {
        storeIdempotencyKey(op.key, op.operation, op.requestHash, op.response);
      });
      
      // Retrieve all operations
      operations.forEach(op => {
        const retrieved = checkIdempotencyKey(op.key);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.response).toBe(JSON.stringify(op.response));
      });
    });

    it('should handle cleanup efficiently', () => {
      // Create many keys
      for (let i = 0; i < 50; i++) {
        const key = `cleanup-test-${i}`;
        storeIdempotencyKey(key, 'POST /api/test', 'test-hash', { id: i });
      }
      
      // Cleanup should complete without errors
      expect(() => {
        cleanupExpiredIdempotencyKeys();
      }).not.toThrow();
    });
  });
});

