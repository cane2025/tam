/**
 * Monthly Reports Routes
 * Handles monthly reports CRUD operations
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { safeQuery, safeQueryOne, safeExecute } from '../database/connection.js';
import { nowInStockholm, isValidMonthId } from '../utils/timezone.js';
import type { 
  MonthlyReport, 
  CreateMonthlyReportRequest, 
  JwtPayload 
} from '../types/database.js';

const router = Router();

/**
 * GET /api/monthly-reports
 * Get all monthly reports for the authenticated user's clients
 */
router.get('/', async (req, res) => {
  try {
    const user = req.user as JwtPayload;
    const { page = 1, limit = 50, search, client_id, month_id } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let query = `
      SELECT mr.*, c.name as client_name, c.initials as client_initials, u.name as staff_name
      FROM monthly_reports mr
      JOIN clients c ON mr.client_id = c.id
      JOIN users u ON c.staff_id = u.id
      WHERE c.staff_id = ?
    `;
    const params: (string | number)[] = [user.userId];
    
    if (client_id) {
      query += ` AND mr.client_id = ?`;
      params.push(String(client_id));
    }
    
    if (month_id) {
      query += ` AND mr.month_id = ?`;
      params.push(String(month_id));
    }
    
    if (search) {
      query += ` AND (c.name LIKE ? OR c.initials LIKE ?)`;
      params.push(`%${String(search)}%`, `%${String(search)}%`);
    }
    
    query += ` ORDER BY mr.month_id DESC, c.name ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);
    
    const monthlyReports = safeQuery<MonthlyReport & { 
      client_name: string; 
      client_initials: string; 
      staff_name: string; 
    }>(query, params);
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM monthly_reports mr
      JOIN clients c ON mr.client_id = c.id
      WHERE c.staff_id = ?
    `;
    const countParams: (string | number)[] = [user.userId];
    
    if (client_id) {
      countQuery += ` AND mr.client_id = ?`;
      countParams.push(String(client_id));
    }
    
    if (month_id) {
      countQuery += ` AND mr.month_id = ?`;
      countParams.push(String(month_id));
    }
    
    if (search) {
      countQuery += ` AND (c.name LIKE ? OR c.initials LIKE ?)`;
      countParams.push(`%${String(search)}%`, `%${String(search)}%`);
    }
    
    const totalResult = safeQueryOne<{ total: number }>(countQuery, countParams);
    const total = totalResult?.total || 0;
    
    res.json({
      success: true,
      data: {
        data: monthlyReports,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
    
  } catch (error) {
    console.error('Get monthly reports error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monthly reports',
      message: 'An error occurred while fetching monthly reports'
    });
  }
});

/**
 * GET /api/monthly-reports/all
 * Get all monthly reports (admin only)
 */
router.get('/all', async (req, res) => {
  try {
    const user = req.user as JwtPayload;
    
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        message: 'Only administrators can view all monthly reports'
      });
    }
    
    const { page = 1, limit = 50, search, client_id, month_id, staff_id } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let query = `
      SELECT mr.*, c.name as client_name, c.initials as client_initials, u.name as staff_name
      FROM monthly_reports mr
      JOIN clients c ON mr.client_id = c.id
      JOIN users u ON c.staff_id = u.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    
    if (client_id) {
      query += ` AND mr.client_id = ?`;
      params.push(String(client_id));
    }
    
    if (month_id) {
      query += ` AND mr.month_id = ?`;
      params.push(String(month_id));
    }
    
    if (staff_id) {
      query += ` AND c.staff_id = ?`;
      params.push(String(staff_id));
    }
    
    if (search) {
      query += ` AND (c.name LIKE ? OR c.initials LIKE ? OR u.name LIKE ?)`;
      params.push(`%${String(search)}%`, `%${String(search)}%`, `%${String(search)}%`);
    }
    
    query += ` ORDER BY mr.month_id DESC, c.name ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);
    
    const monthlyReports = safeQuery<MonthlyReport & { 
      client_name: string; 
      client_initials: string; 
      staff_name: string; 
    }>(query, params);
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM monthly_reports mr
      JOIN clients c ON mr.client_id = c.id
      WHERE 1=1
    `;
    const countParams: (string | number)[] = [];
    
    if (client_id) {
      countQuery += ` AND mr.client_id = ?`;
      countParams.push(String(client_id));
    }
    
    if (month_id) {
      countQuery += ` AND mr.month_id = ?`;
      countParams.push(String(month_id));
    }
    
    if (staff_id) {
      countQuery += ` AND c.staff_id = ?`;
      countParams.push(String(staff_id));
    }
    
    if (search) {
      countQuery += ` AND (c.name LIKE ? OR c.initials LIKE ? OR u.name LIKE ?)`;
      countParams.push(`%${String(search)}%`, `%${String(search)}%`, `%${String(search)}%`);
    }
    
    const totalResult = safeQueryOne<{ total: number }>(countQuery, countParams);
    const total = totalResult?.total || 0;
    
    res.json({
      success: true,
      data: {
        data: monthlyReports,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
    
  } catch (error) {
    console.error('Get all monthly reports error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monthly reports',
      message: 'An error occurred while fetching monthly reports'
    });
  }
});

/**
 * GET /api/monthly-reports/:id
 * Get monthly report by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user as JwtPayload;
    
    const monthlyReport = safeQueryOne<MonthlyReport & { 
      client_name: string; 
      client_initials: string; 
      staff_name: string; 
      staff_id: string;
    }>(`
      SELECT mr.*, c.name as client_name, c.initials as client_initials, 
             u.name as staff_name, c.staff_id
      FROM monthly_reports mr
      JOIN clients c ON mr.client_id = c.id
      JOIN users u ON c.staff_id = u.id
      WHERE mr.id = ?
    `, [id]);
    
    if (!monthlyReport) {
      return res.status(404).json({
        success: false,
        error: 'Monthly report not found',
        message: 'The requested monthly report does not exist'
      });
    }
    
    // Check permissions
    if (user.role !== 'admin' && monthlyReport.staff_id !== user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to view this monthly report'
      });
    }
    
    res.json({
      success: true,
      data: monthlyReport
    });
    
  } catch (error) {
    console.error('Get monthly report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monthly report',
      message: 'An error occurred while fetching the monthly report'
    });
  }
});

/**
 * POST /api/monthly-reports
 * Create new monthly report
 */
router.post('/', async (req, res) => {
  try {
    const user = req.user as JwtPayload;
    const { client_id, month_id, sent, status }: CreateMonthlyReportRequest & { client_id: string } = req.body;
    
    // Validate input
    if (!client_id || !month_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Client ID and month ID are required'
      });
    }
    
    // Validate month ID format
    if (!isValidMonthId(month_id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid month ID format',
        message: 'Month ID must be in YYYY-MM format'
      });
    }
    
    // Check if client exists and user has access
    const client = safeQueryOne<{ id: string; staff_id: string; name: string }>(
      'SELECT id, staff_id, name FROM clients WHERE id = ?',
      [client_id]
    );
    
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found',
        message: 'The specified client does not exist'
      });
    }
    
    // Check permissions
    if (user.role !== 'admin' && client.staff_id !== user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to create monthly reports for this client'
      });
    }
    
    // Check if monthly report already exists for this client and month
    const existingMonthlyReport = safeQueryOne<MonthlyReport>(
      'SELECT id FROM monthly_reports WHERE client_id = ? AND month_id = ?',
      [client_id, month_id]
    );
    
    if (existingMonthlyReport) {
      return res.status(409).json({
        success: false,
        error: 'Monthly report already exists',
        message: 'Monthly report already exists for this client and month'
      });
    }
    
    // Create monthly report
    const monthlyReportId = uuidv4();
    const now = nowInStockholm().toISOString();
    
    safeExecute(
      `INSERT INTO monthly_reports (id, client_id, month_id, sent, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        monthlyReportId,
        client_id,
        month_id,
        sent ? 1 : 0,
        status || 'pending',
        now,
        now
      ]
    );
    
    // Get created monthly report
    const newMonthlyReport = safeQueryOne<MonthlyReport>(
      'SELECT * FROM monthly_reports WHERE id = ?',
      [monthlyReportId]
    );
    
    if (!newMonthlyReport) {
      throw new Error('Failed to retrieve created monthly report');
    }
    
    res.status(201).json({
      success: true,
      data: newMonthlyReport
    });
    
  } catch (error) {
    console.error('Create monthly report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create monthly report',
      message: 'An error occurred while creating the monthly report'
    });
  }
});

/**
 * PUT /api/monthly-reports/:id
 * Update monthly report
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user as JwtPayload;
    const { month_id, sent, status } = req.body;
    
    // Get existing monthly report with client info
    const existingMonthlyReport = safeQueryOne<MonthlyReport & { 
      client_name: string; 
      staff_id: string;
    }>(`
      SELECT mr.*, c.name as client_name, c.staff_id
      FROM monthly_reports mr
      JOIN clients c ON mr.client_id = c.id
      WHERE mr.id = ?
    `, [id]);
    
    if (!existingMonthlyReport) {
      return res.status(404).json({
        success: false,
        error: 'Monthly report not found',
        message: 'The requested monthly report does not exist'
      });
    }
    
    // Check permissions
    if (user.role !== 'admin' && existingMonthlyReport.staff_id !== user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to update this monthly report'
      });
    }
    
    // Validate month ID format if provided
    if (month_id && !isValidMonthId(month_id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid month ID format',
        message: 'Month ID must be in YYYY-MM format'
      });
    }
    
    // Check if new month_id already exists for this client
    if (month_id && month_id !== existingMonthlyReport.month_id) {
      const duplicateMonthlyReport = safeQueryOne<MonthlyReport>(
        'SELECT id FROM monthly_reports WHERE client_id = ? AND month_id = ? AND id != ?',
        [existingMonthlyReport.client_id, month_id, id]
      );
      
      if (duplicateMonthlyReport) {
        return res.status(409).json({
          success: false,
          error: 'Monthly report already exists',
          message: 'Monthly report already exists for this client and month'
        });
      }
    }
    
    // Build update query
    const updates: string[] = [];
    const params: (string | number)[] = [];
    
    if (month_id !== undefined) {
      updates.push('month_id = ?');
      params.push(String(month_id));
    }
    
    if (sent !== undefined) {
      updates.push('sent = ?');
      params.push(sent ? 1 : 0);
    }
    
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No changes provided',
        message: 'No valid fields to update'
      });
    }
    
    updates.push('updated_at = ?');
    params.push(nowInStockholm().toISOString());
    params.push(id);
    
    const query = `UPDATE monthly_reports SET ${updates.join(', ')} WHERE id = ?`;
    safeExecute(query, params);
    
    // Get updated monthly report
    const updatedMonthlyReport = safeQueryOne<MonthlyReport>(
      'SELECT * FROM monthly_reports WHERE id = ?',
      [id]
    );
    
    if (!updatedMonthlyReport) {
      throw new Error('Failed to retrieve updated monthly report');
    }
    
    res.json({
      success: true,
      data: updatedMonthlyReport
    });
    
  } catch (error) {
    console.error('Update monthly report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update monthly report',
      message: 'An error occurred while updating the monthly report'
    });
  }
});

/**
 * DELETE /api/monthly-reports/:id
 * Delete monthly report
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user as JwtPayload;
    
    // Get existing monthly report with client info
    const existingMonthlyReport = safeQueryOne<MonthlyReport & { staff_id: string }>(
      `SELECT mr.*, c.staff_id
       FROM monthly_reports mr
       JOIN clients c ON mr.client_id = c.id
       WHERE mr.id = ?`,
      [id]
    );
    
    if (!existingMonthlyReport) {
      return res.status(404).json({
        success: false,
        error: 'Monthly report not found',
        message: 'The requested monthly report does not exist'
      });
    }
    
    // Check permissions
    if (user.role !== 'admin' && existingMonthlyReport.staff_id !== user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to delete this monthly report'
      });
    }
    
    // Delete monthly report
    safeExecute('DELETE FROM monthly_reports WHERE id = ?', [id]);
    
    res.json({
      success: true,
      data: {
        message: 'Monthly report deleted successfully'
      }
    });
    
  } catch (error) {
    console.error('Delete monthly report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete monthly report',
      message: 'An error occurred while deleting the monthly report'
    });
  }
});

export default router;
