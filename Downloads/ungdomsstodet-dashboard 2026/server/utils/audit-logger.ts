/**
 * Audit Logging System
 * Tracks all security-relevant operations for compliance and monitoring
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';

export interface AuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
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
}

class AuditLogger {
  private db: Database.Database;
  private options: Required<AuditLoggerOptions>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(db: Database.Database, options: AuditLoggerOptions = {}) {
    this.db = db;
    this.options = {
      retentionDays: options.retentionDays || 90,
      enableConsoleLogging: options.enableConsoleLogging ?? true,
      enableDatabaseLogging: options.enableDatabaseLogging ?? true,
      sensitiveFields: options.sensitiveFields || ['password', 'password_hash', 'token', 'secret']
    };

    this.initializeTables();
    this.startCleanupScheduler();
  }

  private initializeTables(): void {
    // Create audit_logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        resource_id TEXT,
        details TEXT NOT NULL, -- JSON string
        ip_address TEXT NOT NULL,
        user_agent TEXT NOT NULL,
        success BOOLEAN NOT NULL,
        error_message TEXT
      )
    `);

    // Create index for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
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

      const stmt = this.db.prepare('DELETE FROM audit_logs WHERE timestamp < ?');
      const result = stmt.run(cutoffTimestamp);
      
      if (this.options.enableConsoleLogging) {
        console.log(`🧹 Cleaned up ${result.changes} old audit logs (older than ${this.options.retentionDays} days)`);
      }
    } catch (error) {
      console.error('❌ Failed to cleanup audit logs:', error);
    }
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
      const user = (req as unknown as { user?: { userId: string; email: string } }).user;
      const userId = user?.userId || 'anonymous';
      const userEmail = user?.email || 'unknown@example.com';
      
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        userId,
        userEmail,
        action,
        resource,
        resourceId,
        details: this.sanitizeDetails(details),
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        success,
        errorMessage
      };

      // Console logging
      if (this.options.enableConsoleLogging) {
        const level = success ? 'INFO' : 'ERROR';
        const message = `${level} [AUDIT] ${action} on ${resource} by ${userEmail} (${userId})`;
        console.log(message, { details: auditEvent.details, resourceId });
      }

      // Database logging
      if (this.options.enableDatabaseLogging) {
        const stmt = this.db.prepare(`
          INSERT INTO audit_logs (id, timestamp, user_id, user_email, action, resource, resource_id, details, ip_address, user_agent, success, error_message)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          auditEvent.id,
          auditEvent.timestamp,
          auditEvent.userId,
          auditEvent.userEmail,
          auditEvent.action,
          auditEvent.resource,
          auditEvent.resourceId,
          JSON.stringify(auditEvent.details),
          auditEvent.ipAddress,
          auditEvent.userAgent,
          auditEvent.success ? 1 : 0,
          auditEvent.errorMessage
        );
      }
    } catch (error) {
      console.error('❌ Failed to log audit event:', error);
    }
  }

  public getAuditLogs(
    filters: {
      userId?: string;
      action?: AuditAction;
      resource?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): AuditEvent[] {
    try {
      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params: any[] = [];

      if (filters.userId) {
        query += ' AND user_id = ?';
        params.push(filters.userId);
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
        user_id: string;
        user_email: string;
        action: string;
        resource: string;
        resource_id: string | null;
        details: string;
        ip_address: string;
        user_agent: string;
        success: number;
        error_message: string | null;
      }>;

      return rows.map(row => ({
        ...row,
        details: JSON.parse(row.details),
        success: Boolean(row.success)
      }));
    } catch (error) {
      console.error('❌ Failed to get audit logs:', error);
      return [];
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

export default AuditLogger;
