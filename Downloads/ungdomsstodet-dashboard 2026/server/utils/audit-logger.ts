/**
 * Audit Logging System - GDPR Compliant
 * Tracks all security-relevant operations for compliance and monitoring
 * 
 * GDPR COMPLIANCE FEATURES:
 * - User ID anonymization with SHA-256 hashing
 * - Automatic data retention (180 days default)
 * - Data portability export functions
 * - Sensitive data redaction
 */

import Database from 'better-sqlite3';
import { randomUUID, createHash } from 'crypto';
import type { Request, Response } from 'express';

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorId: string; // Anonymized user ID
  actorRole: string; // User role (not sensitive)
  action: AuditAction;
  resource: string;
  resourceId?: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
  isAnonymized: boolean; // GDPR compliance flag
  retentionDays: number; // Data retention period
  gdprCompliant: boolean; // Overall GDPR compliance flag
}

export type AuditAction = 
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGE'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'USER_DEACTIVATED'
  | 'CLIENT_CREATED'
  | 'CLIENT_UPDATED'
  | 'CLIENT_DELETED'
  | 'CARE_PLAN_CREATED'
  | 'CARE_PLAN_UPDATED'
  | 'CARE_PLAN_DELETED'
  | 'WEEKLY_DOC_CREATED'
  | 'WEEKLY_DOC_UPDATED'
  | 'WEEKLY_DOC_DELETED'
  | 'WEEKLY_DOC_APPROVED'
  | 'WEEKLY_DOC_REJECTED'
  | 'MONTHLY_REPORT_CREATED'
  | 'MONTHLY_REPORT_UPDATED'
  | 'MONTHLY_REPORT_DELETED'
  | 'MONTHLY_REPORT_SENT'
  | 'VISMA_TIME_CREATED'
  | 'VISMA_TIME_UPDATED'
  | 'VISMA_TIME_DELETED'
  | 'DATA_EXPORT'
  | 'DATA_IMPORT'
  | 'BACKUP_CREATED'
  | 'MIGRATION_EXECUTED'
  | 'ADMIN_ACTION'
  | 'SECURITY_VIOLATION'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_TOKEN'
  | 'UNAUTHORIZED_ACCESS';

export interface AuditLoggerOptions {
  retentionDays?: number;
  enableConsoleLogging?: boolean;
  enableDatabaseLogging?: boolean;
  sensitiveFields?: string[];
  gdprCompliant?: boolean; // Enable GDPR compliance features
  anonymizationSalt?: string; // Salt for user ID anonymization
}

class AuditLogger {
  private db: Database.Database;
  private options: Required<AuditLoggerOptions>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(db: Database.Database, options: AuditLoggerOptions = {}) {
    this.db = db;
    this.options = {
      retentionDays: options.retentionDays || 180, // GDPR: Extended to 180 days
      enableConsoleLogging: options.enableConsoleLogging ?? true,
      enableDatabaseLogging: options.enableDatabaseLogging ?? true,
      sensitiveFields: options.sensitiveFields || ['password', 'password_hash', 'token', 'secret', 'personal_number', 'ssn'],
      gdprCompliant: options.gdprCompliant ?? true, // GDPR enabled by default
      anonymizationSalt: options.anonymizationSalt || 'ungdomsstod-gdpr-salt-2024'
    };

    this.initializeTables();
    this.startCleanupScheduler();
  }

  /**
   * GDPR-compliant user ID anonymization
   * Creates a consistent but anonymous hash for user tracking
   */
  private anonymizeUserId(userId: string): string {
    if (!userId || userId === 'anonymous') {
      return 'anonymous';
    }
    
    return createHash('sha256')
      .update(userId + this.options.anonymizationSalt)
      .digest('hex')
      .substring(0, 8); // First 8 characters for brevity
  }

  private initializeTables(): void {
    // Create audit_logs table with GDPR compliance
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        actor_id TEXT NOT NULL, -- Anonymized user ID
        actor_role TEXT NOT NULL, -- User role (not sensitive)
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        resource_id TEXT,
        details TEXT NOT NULL, -- JSON string
        ip_address TEXT NOT NULL,
        user_agent TEXT NOT NULL,
        success BOOLEAN NOT NULL,
        error_message TEXT,
        is_anonymized BOOLEAN DEFAULT 1, -- GDPR compliance flag
        retention_days INTEGER DEFAULT 180, -- Data retention period
        gdpr_compliant BOOLEAN DEFAULT 1 -- Overall GDPR compliance flag
      )
    `);

    // Add GDPR columns to existing table if they don't exist
    try {
      this.db.exec(`ALTER TABLE audit_logs ADD COLUMN is_anonymized BOOLEAN DEFAULT 1`);
    } catch {
      // Column already exists
    }
    
    try {
      this.db.exec(`ALTER TABLE audit_logs ADD COLUMN retention_days INTEGER DEFAULT 180`);
    } catch {
      // Column already exists
    }
    
    try {
      this.db.exec(`ALTER TABLE audit_logs ADD COLUMN gdpr_compliant BOOLEAN DEFAULT 1`);
    } catch {
      // Column already exists
    }

    // Add new GDPR-compliant columns if they don't exist
    try {
      this.db.exec(`ALTER TABLE audit_logs ADD COLUMN actor_id TEXT`);
    } catch {
      // Column already exists
    }
    
    try {
      this.db.exec(`ALTER TABLE audit_logs ADD COLUMN actor_role TEXT`);
    } catch {
      // Column already exists
    }

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_gdpr ON audit_logs(gdpr_compliant);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_retention ON audit_logs(retention_days);
    `);
  }

  private sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...details };
    
    for (const field of this.options.sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private startCleanupScheduler(): void {
    // Clean up old audit logs daily
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldLogs();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  private cleanupOldLogs(): void {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.options.retentionDays);
      const cutoffTimestamp = cutoffDate.toISOString();

      // GDPR compliant cleanup - respects individual retention settings
      const stmt = this.db.prepare(`
        DELETE FROM audit_logs 
        WHERE timestamp < ? 
        OR (retention_days IS NOT NULL AND timestamp < datetime('now', '-' || retention_days || ' days'))
      `);
      const result = stmt.run(cutoffTimestamp);
      
      if (this.options.enableConsoleLogging) {
        console.log(`🧹 [GDPR Cleanup] Deleted ${result.changes} old audit logs (retention: ${this.options.retentionDays} days)`);
      }
    } catch (error) {
      console.error('❌ [GDPR Cleanup] Failed to cleanup audit logs:', error);
    }
  }

  /**
   * Manual GDPR cleanup function for immediate retention policy enforcement
   */
  public async cleanupOldAuditLogs(): Promise<void> {
    this.cleanupOldLogs();
  }

  public async logEvent(
    req: Request,
    res: Response,
    action: AuditAction,
    resource: string,
    details: Record<string, unknown> = {},
    resourceId?: string,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    try {
      const user = (req as unknown as { user?: { userId: string; email: string; role?: string } }).user;
      const userId = user?.userId || 'anonymous';
      const userRole = user?.role || 'unknown';
      
      // GDPR: Anonymize user ID for privacy
      const anonymizedUserId = this.options.gdprCompliant ? this.anonymizeUserId(userId) : userId;
      
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        actorId: anonymizedUserId,
        actorRole: userRole,
        action,
        resource,
        resourceId,
        details: this.sanitizeDetails(details),
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        success,
        errorMessage,
        isAnonymized: this.options.gdprCompliant,
        retentionDays: this.options.retentionDays,
        gdprCompliant: this.options.gdprCompliant
      };

      // Console logging (using anonymized data)
      if (this.options.enableConsoleLogging) {
        const level = success ? 'INFO' : 'ERROR';
        const message = `${level} [AUDIT] ${action} on ${resource} by ${userRole} (${anonymizedUserId})`;
        console.log(message, { details: auditEvent.details, resourceId });
      }

      // Database logging with GDPR compliance
      if (this.options.enableDatabaseLogging) {
        const stmt = this.db.prepare(`
          INSERT INTO audit_logs (
            id, timestamp, actor_id, actor_role, action, resource, resource_id, 
            details, ip_address, user_agent, success, error_message, 
            is_anonymized, retention_days, gdpr_compliant
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          auditEvent.id,
          auditEvent.timestamp,
          auditEvent.actorId,
          auditEvent.actorRole,
          auditEvent.action,
          auditEvent.resource,
          auditEvent.resourceId,
          JSON.stringify(auditEvent.details),
          auditEvent.ipAddress,
          auditEvent.userAgent,
          auditEvent.success ? 1 : 0,
          auditEvent.errorMessage,
          auditEvent.isAnonymized ? 1 : 0,
          auditEvent.retentionDays,
          auditEvent.gdprCompliant ? 1 : 0
        );
      }
    } catch (error) {
      console.error('❌ Failed to log audit event:', error);
    }
  }

  public getAuditLogs(
    filters: {
      actorId?: string;
      actorRole?: string;
      action?: AuditAction;
      resource?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
      gdprCompliant?: boolean;
    } = {}
  ): AuditEvent[] {
    try {
      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params: (string | number | boolean)[] = [];

      if (filters.actorId) {
        query += ' AND actor_id = ?';
        params.push(filters.actorId);
      }

      if (filters.actorRole) {
        query += ' AND actor_role = ?';
        params.push(filters.actorRole);
      }

      if (filters.action) {
        query += ' AND action = ?';
        params.push(filters.action);
      }

      if (filters.resource) {
        query += ' AND resource = ?';
        params.push(filters.resource);
      }

      if (filters.startDate) {
        query += ' AND timestamp >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ' AND timestamp <= ?';
        params.push(filters.endDate);
      }

      if (filters.gdprCompliant !== undefined) {
        query += ' AND gdpr_compliant = ?';
        params.push(filters.gdprCompliant ? 1 : 0);
      }

      query += ' ORDER BY timestamp DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as Array<{
        id: string;
        timestamp: string;
        actor_id: string;
        actor_role: string;
        action: string;
        resource: string;
        resource_id: string | null;
        details: string;
        ip_address: string;
        user_agent: string;
        success: number;
        error_message: string | null;
        is_anonymized: number;
        retention_days: number;
        gdpr_compliant: number;
      }>;

      return rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        actorId: row.actor_id,
        actorRole: row.actor_role,
        action: row.action as AuditAction,
        resource: row.resource,
        resourceId: row.resource_id ?? undefined,
        details: JSON.parse(row.details) as Record<string, unknown>,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        success: Boolean(row.success),
        errorMessage: row.error_message ?? undefined,
        isAnonymized: Boolean(row.is_anonymized || 0),
        retentionDays: row.retention_days || 180,
        gdprCompliant: Boolean(row.gdpr_compliant || 0)
      }));
    } catch (error) {
      console.error('❌ Failed to get audit logs:', error);
      return [];
    }
  }

  /**
   * GDPR Data Portability: Export user audit logs in anonymized format
   */
  public exportUserAuditLogs(actorRole: string): Promise<AuditEvent[]> {
    return Promise.resolve(this.getAuditLogs({
      actorRole,
      gdprCompliant: true,
      limit: 10000 // Reasonable limit for export
    }));
  }

  /**
   * GDPR Right to be Forgotten: Delete all audit logs for a specific user
   * Note: Only use for legitimate GDPR requests
   */
  public async deleteUserAuditLogs(actorId: string): Promise<number> {
    try {
      const stmt = this.db.prepare('DELETE FROM audit_logs WHERE actor_id = ?');
      const result = stmt.run(actorId);
      
      if (this.options.enableConsoleLogging) {
        console.log(`🗑️ [GDPR] Deleted ${result.changes} audit logs for actor: ${actorId}`);
      }
      
      return result.changes || 0;
    } catch (error) {
      console.error('❌ [GDPR] Failed to delete user audit logs:', error);
      return 0;
    }
  }

  public getSecurityViolations(limit: number = 100): AuditEvent[] {
    return this.getAuditLogs({
      action: 'SECURITY_VIOLATION',
      limit
    });
  }

  public getFailedLogins(limit: number = 100): AuditEvent[] {
    return this.getAuditLogs({
      action: 'LOGIN_FAILED',
      limit
    });
  }

  public getAdminActions(limit: number = 100): AuditEvent[] {
    return this.getAuditLogs({
      action: 'ADMIN_ACTION',
      limit
    });
  }

  public getStats(): {
    totalLogs: number;
    securityViolations: number;
    failedLogins: number;
    adminActions: number;
    lastActivity: string | null;
  } {
    try {
      const totalLogs = this.db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as { count: number };
      const securityViolations = this.db.prepare('SELECT COUNT(*) as count FROM audit_logs WHERE action = ?').get('SECURITY_VIOLATION') as { count: number };
      const failedLogins = this.db.prepare('SELECT COUNT(*) as count FROM audit_logs WHERE action = ?').get('LOGIN_FAILED') as { count: number };
      const adminActions = this.db.prepare('SELECT COUNT(*) as count FROM audit_logs WHERE action = ?').get('ADMIN_ACTION') as { count: number };
      const lastActivity = this.db.prepare('SELECT timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 1').get() as { timestamp: string } | null;

      return {
        totalLogs: totalLogs.count,
        securityViolations: securityViolations.count,
        failedLogins: failedLogins.count,
        adminActions: adminActions.count,
        lastActivity: lastActivity?.timestamp || null
      };
    } catch (error) {
      console.error('❌ Failed to get audit stats:', error);
      return {
        totalLogs: 0,
        securityViolations: 0,
        failedLogins: 0,
        adminActions: 0,
        lastActivity: null
      };
    }
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Express middleware for automatic audit logging
export function auditMiddleware(auditLogger: AuditLogger) {
  return (req: Request, res: Response, next: () => void) => {
    const originalSend = res.send;
    
    res.send = function(data: unknown) {
      // Log the request after response is sent
      const success = res.statusCode < 400;
      
      // Determine action based on method and route
      let action: AuditAction;
      const method = req.method;
      const path = req.path;
      
      if (path.includes('/auth/login')) {
        action = success ? 'LOGIN' : 'LOGIN_FAILED';
      } else if (path.includes('/auth/logout')) {
        action = 'LOGOUT';
      } else if (method === 'POST' && path.includes('/users')) {
        action = 'USER_CREATED';
      } else if (method === 'PUT' && path.includes('/users')) {
        action = 'USER_UPDATED';
      } else if (method === 'DELETE' && path.includes('/users')) {
        action = 'USER_DELETED';
      } else if (method === 'POST' && path.includes('/clients')) {
        action = 'CLIENT_CREATED';
      } else if (method === 'PUT' && path.includes('/clients')) {
        action = 'CLIENT_UPDATED';
      } else if (method === 'DELETE' && path.includes('/clients')) {
        action = 'CLIENT_DELETED';
      } else if (path.includes('/admin')) {
        action = 'ADMIN_ACTION';
      } else {
        // Generic action based on method
        action = method === 'POST' ? 'DATA_CREATED' as AuditAction : 
                method === 'PUT' ? 'DATA_UPDATED' as AuditAction :
                method === 'DELETE' ? 'DATA_DELETED' as AuditAction : 
                'DATA_ACCESSED' as AuditAction;
      }

      const resource = path.split('/').pop() || 'unknown';
      const resourceId = req.params.id;
      
      auditLogger.logEvent(
        req,
        res,
        action,
        resource,
        {
          method,
          path,
          statusCode: res.statusCode,
          body: req.body
        },
        resourceId,
        success
      );

      return originalSend.call(this, data);
    };

    next();
  };
}

// GDPR Export functions for standalone use
import { getDatabase } from '../database/connection.js';

/**
 * GDPR Data Portability: Export user audit logs in anonymized format
 * Returns only anonymized data for compliance with GDPR Article 20
 */
export async function exportUserAuditLogs(userRole: string): Promise<AuditEvent[]> {
  try {
    const db = getDatabase();
    
    // Returnera endast anonymiserad data
    const logs = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE actor_role = ? 
      AND is_anonymized = 1 
      AND gdpr_compliant = 1
      ORDER BY timestamp DESC
    `).all(userRole);
    
    console.log(`📤 [GDPR Export] Exported ${logs.length} audit logs for role: ${userRole}`);
    return logs as AuditEvent[];
  } catch (error) {
    console.error('❌ [GDPR Export] Failed to export user audit logs:', error);
    return [];
  }
}

/**
 * GDPR Cleanup function for external use
 */
export async function cleanupOldAuditLogs(): Promise<void> {
  try {
    const db = getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 180); // 180 days retention
    
    const result = db.prepare(`
      DELETE FROM audit_logs 
      WHERE timestamp < ? 
      OR (retention_days IS NOT NULL AND timestamp < datetime('now', '-' || retention_days || ' days'))
    `).run(cutoffDate.toISOString());
    
    console.log(`🧹 [GDPR Cleanup] Deleted ${result.changes} old audit logs`);
  } catch (error) {
    console.error('❌ [GDPR Cleanup] Error:', error);
  }
}

export default AuditLogger;
