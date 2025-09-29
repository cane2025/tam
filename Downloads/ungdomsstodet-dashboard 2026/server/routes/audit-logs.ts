/**
 * Audit Logs API Routes
 * Provides access to audit logs for administrators
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import Database from 'better-sqlite3';
import AuditLogger, { type AuditAction } from '../utils/audit-logger.js';
import type { JwtPayload } from '../types/database.js';

const router = Router();

// Get audit logger instance
let auditLogger: AuditLogger;

export function initializeAuditRoutes(db: Database.Database) {
  auditLogger = new AuditLogger(db);
  return router;
}

export { auditLogger };

// Middleware to ensure user is admin
function requireAdmin(req: Request, res: Response, next: () => void) {
  const user = (req as { user?: JwtPayload }).user;
  if (user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      message: 'Only administrators can access audit logs'
    });
  }
  next();
}

// Get audit logs with filtering
router.get('/', requireAdmin, (req: Request, res: Response) => {
  try {
    const {
      userId,
      action,
      resource,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = req.query;

    const filters = {
      userId: userId as string,
      action: action as AuditAction,
      resource: resource as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };

    const logs = auditLogger.getAuditLogs(filters);

    res.json({
      success: true,
      data: {
        logs,
        filters,
        count: logs.length
      }
    });
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit logs',
      message: 'An error occurred while fetching audit logs'
    });
  }
});

// Get security violations
router.get('/security-violations', requireAdmin, (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const violations = auditLogger.getSecurityViolations(limit);

    res.json({
      success: true,
      data: {
        violations,
        count: violations.length
      }
    });
  } catch (error) {
    console.error('Failed to get security violations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security violations',
      message: 'An error occurred while fetching security violations'
    });
  }
});

// Get failed login attempts
router.get('/failed-logins', requireAdmin, (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const failedLogins = auditLogger.getFailedLogins(limit);

    res.json({
      success: true,
      data: {
        failedLogins,
        count: failedLogins.length
      }
    });
  } catch (error) {
    console.error('Failed to get failed logins:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve failed logins',
      message: 'An error occurred while fetching failed login attempts'
    });
  }
});

// Get admin actions
router.get('/admin-actions', requireAdmin, (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const adminActions = auditLogger.getAdminActions(limit);

    res.json({
      success: true,
      data: {
        adminActions,
        count: adminActions.length
      }
    });
  } catch (error) {
    console.error('Failed to get admin actions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve admin actions',
      message: 'An error occurred while fetching admin actions'
    });
  }
});

// Get audit statistics
router.get('/stats', requireAdmin, (req: Request, res: Response) => {
  try {
    const stats = auditLogger.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Failed to get audit stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit statistics',
      message: 'An error occurred while fetching audit statistics'
    });
  }
});

// Export audit logs (CSV format)
router.get('/export', requireAdmin, (req: Request, res: Response) => {
  try {
    const {
      startDate,
      endDate,
      action,
      resource
    } = req.query;

    const filters = {
      startDate: startDate as string,
      endDate: endDate as string,
      action: action as AuditAction,
      resource: resource as string,
      limit: 10000 // Large limit for export
    };

    const logs = auditLogger.getAuditLogs(filters);

    // Generate CSV
    const headers = [
      'Timestamp',
      'Actor ID (Anonymized)',
      'Actor Role',
      'Action',
      'Resource',
      'Resource ID',
      'IP Address',
      'User Agent',
      'Success',
      'Error Message',
      'Details'
    ];

    const csvRows = logs.map(log => [
      log.timestamp,
      log.actorId,
      log.actorRole,
      log.action,
      log.resource,
      log.resourceId || '',
      log.ipAddress,
      log.userAgent,
      log.success,
      log.errorMessage || '',
      JSON.stringify(log.details)
    ]);

    const csvContent = [headers, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Failed to export audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export audit logs',
      message: 'An error occurred while exporting audit logs'
    });
  }
});

// GDPR Data Portability: Export user's own audit logs (anonymized)
router.get('/gdpr-export/:userRole', async (req: Request, res: Response) => {
  try {
    const { userRole } = req.params;
    const user = (req as { user?: JwtPayload }).user;
    
    // Users can only export their own role's data, admins can export any role
    if (user?.role !== 'admin' && user?.role !== userRole) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized',
        message: 'You can only export your own audit data'
      });
    }

    // Use the standalone GDPR export function
    const { exportUserAuditLogs } = await import('../utils/audit-logger.js');
    const logs = await exportUserAuditLogs(userRole || 'unknown');

    const filename = `gdpr-audit-export-${userRole}-${new Date().toISOString().split('T')[0]}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json({
      success: true,
      message: 'GDPR audit data export',
      userRole,
      totalLogs: logs.length,
      exportDate: new Date().toISOString(),
      gdprCompliant: true,
      anonymized: true,
      data: logs
    });

    // Log the export action
    if (auditLogger) {
      await auditLogger.logEvent(
        req,
        res,
        'DATA_EXPORT',
        'audit_logs',
        { exportType: 'gdpr', userRole, recordCount: logs.length },
        undefined,
        true
      );
    }
  } catch (error) {
    console.error('Failed to export GDPR audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export GDPR audit logs',
      message: 'An error occurred while exporting your audit data'
    });
  }
});

export default router;
