/**
 * Visma Time Routes
 * Handles Visma time tracking CRUD operations
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { safeQuery, safeQueryOne, safeExecute } from '../database/connection.js';
import { nowInStockholm, isValidWeekId } from '../utils/timezone.js';
import type { 
  VismaTime, 
  CreateVismaTimeRequest, 
  ApiResponse, 
  PaginatedResponse, 
  JwtPayload 
} from '../types/database.js';

const router = Router();

/**
 * GET /api/visma-time
 * Get all Visma time entries for the authenticated user's clients
 */
router.get('/', async (req, res) => {
  try {
    const user = req.user as JwtPayload;
    const { page = 1, limit = 50, search, client_id, week_id } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let query = `
      SELECT vt.*, c.name as client_name, c.initials as client_initials, u.name as staff_name
      FROM visma_time vt
      JOIN clients c ON vt.client_id = c.id
      JOIN users u ON c.staff_id = u.id
      WHERE c.staff_id = ?
    `;
    const params: any[] = [user.userId];
    
    if (client_id) {
      query += ` AND vt.client_id = ?`;
      params.push(client_id);
    }
    
    if (week_id) {
      query += ` AND vt.week_id = ?`;
      params.push(week_id);
    }
    
    if (search) {
      query += ` AND (c.name LIKE ? OR c.initials LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ` ORDER BY vt.week_id DESC, c.name ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);
    
    const vismaTime = safeQuery<VismaTime & { 
      client_name: string; 
      client_initials: string; 
      staff_name: string; 
    }>(query, params);
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM visma_time vt
      JOIN clients c ON vt.client_id = c.id
      WHERE c.staff_id = ?
    `;
    const countParams: any[] = [user.userId];
    
    if (client_id) {
      countQuery += ` AND vt.client_id = ?`;
      countParams.push(client_id);
    }
    
    if (week_id) {
      countQuery += ` AND vt.week_id = ?`;
      countParams.push(week_id);
    }
    
    if (search) {
      countQuery += ` AND (c.name LIKE ? OR c.initials LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
    }
    
    const totalResult = safeQueryOne<{ total: number }>(countQuery, countParams);
    const total = totalResult?.total || 0;
    
    res.json({
      success: true,
      data: {
        data: vismaTime,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
    
  } catch (error) {
    console.error('Get Visma time error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Visma time entries',
      message: 'An error occurred while fetching Visma time entries'
    });
  }
});

/**
 * GET /api/visma-time/all
 * Get all Visma time entries (admin only)
 */
router.get('/all', async (req, res) => {
  try {
    const user = req.user as JwtPayload;
    
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        message: 'Only administrators can view all Visma time entries'
      });
    }
    
    const { page = 1, limit = 50, search, client_id, week_id, staff_id } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let query = `
      SELECT vt.*, c.name as client_name, c.initials as client_initials, u.name as staff_name
      FROM visma_time vt
      JOIN clients c ON vt.client_id = c.id
      JOIN users u ON c.staff_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (client_id) {
      query += ` AND vt.client_id = ?`;
      params.push(client_id);
    }
    
    if (week_id) {
      query += ` AND vt.week_id = ?`;
      params.push(week_id);
    }
    
    if (staff_id) {
      query += ` AND c.staff_id = ?`;
      params.push(staff_id);
    }
    
    if (search) {
      query += ` AND (c.name LIKE ? OR c.initials LIKE ? OR u.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    query += ` ORDER BY vt.week_id DESC, c.name ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);
    
    const vismaTime = safeQuery<VismaTime & { 
      client_name: string; 
      client_initials: string; 
      staff_name: string; 
    }>(query, params);
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM visma_time vt
      JOIN clients c ON vt.client_id = c.id
      WHERE 1=1
    `;
    const countParams: any[] = [];
    
    if (client_id) {
      countQuery += ` AND vt.client_id = ?`;
      countParams.push(client_id);
    }
    
    if (week_id) {
      countQuery += ` AND vt.week_id = ?`;
      countParams.push(week_id);
    }
    
    if (staff_id) {
      countQuery += ` AND c.staff_id = ?`;
      countParams.push(staff_id);
    }
    
    if (search) {
      countQuery += ` AND (c.name LIKE ? OR c.initials LIKE ? OR u.name LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    const totalResult = safeQueryOne<{ total: number }>(countQuery, countParams);
    const total = totalResult?.total || 0;
    
    res.json({
      success: true,
      data: {
        data: vismaTime,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
    
  } catch (error) {
    console.error('Get all Visma time error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Visma time entries',
      message: 'An error occurred while fetching Visma time entries'
    });
  }
});

/**
 * GET /api/visma-time/:id
 * Get Visma time entry by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user as JwtPayload;
    
    const vismaTime = safeQueryOne<VismaTime & { 
      client_name: string; 
      client_initials: string; 
      staff_name: string; 
      staff_id: string;
    }>(`
      SELECT vt.*, c.name as client_name, c.initials as client_initials, 
             u.name as staff_name, c.staff_id
      FROM visma_time vt
      JOIN clients c ON vt.client_id = c.id
      JOIN users u ON c.staff_id = u.id
      WHERE vt.id = ?
    `, [id]);
    
    if (!vismaTime) {
      return res.status(404).json({
        success: false,
        error: 'Visma time entry not found',
        message: 'The requested Visma time entry does not exist'
      });
    }
    
    // Check permissions
    if (user.role !== 'admin' && vismaTime.staff_id !== user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to view this Visma time entry'
      });
    }
    
    res.json({
      success: true,
      data: vismaTime
    });
    
  } catch (error) {
    console.error('Get Visma time entry error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Visma time entry',
      message: 'An error occurred while fetching the Visma time entry'
    });
  }
});

/**
 * POST /api/visma-time
 * Create new Visma time entry
 */
router.post('/', async (req, res) => {
  try {
    const user = req.user as JwtPayload;
    const { client_id, week_id, monday, tuesday, wednesday, thursday, friday, status }: CreateVismaTimeRequest & { client_id: string } = req.body;
    
    // Validate input
    if (!client_id || !week_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Client ID and week ID are required'
      });
    }
    
    // Validate week ID format
    if (!isValidWeekId(week_id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid week ID format',
        message: 'Week ID must be in YYYY-WXX format'
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
        message: 'You do not have permission to create Visma time entries for this client'
      });
    }
    
    // Check if Visma time entry already exists for this client and week
    const existingVismaTime = safeQueryOne<VismaTime>(
      'SELECT id FROM visma_time WHERE client_id = ? AND week_id = ?',
      [client_id, week_id]
    );
    
    if (existingVismaTime) {
      return res.status(409).json({
        success: false,
        error: 'Visma time entry already exists',
        message: 'Visma time entry already exists for this client and week'
      });
    }
    
    // Create Visma time entry
    const vismaTimeId = uuidv4();
    const now = nowInStockholm().toISOString();
    
    safeExecute(
      `INSERT INTO visma_time (id, client_id, week_id, monday, tuesday, wednesday, thursday, friday, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vismaTimeId,
        client_id,
        week_id,
        monday ? 1 : 0,
        tuesday ? 1 : 0,
        wednesday ? 1 : 0,
        thursday ? 1 : 0,
        friday ? 1 : 0,
        status || 'pending',
        now,
        now
      ]
    );
    
    // Get created Visma time entry
    const newVismaTime = safeQueryOne<VismaTime>(
      'SELECT * FROM visma_time WHERE id = ?',
      [vismaTimeId]
    );
    
    if (!newVismaTime) {
      throw new Error('Failed to retrieve created Visma time entry');
    }
    
    res.status(201).json({
      success: true,
      data: newVismaTime
    });
    
  } catch (error) {
    console.error('Create Visma time entry error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create Visma time entry',
      message: 'An error occurred while creating the Visma time entry'
    });
  }
});

/**
 * PUT /api/visma-time/:id
 * Update Visma time entry
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user as JwtPayload;
    const { week_id, monday, tuesday, wednesday, thursday, friday, status } = req.body;
    
    // Get existing Visma time entry with client info
    const existingVismaTime = safeQueryOne<VismaTime & { 
      client_name: string; 
      staff_id: string;
    }>(`
      SELECT vt.*, c.name as client_name, c.staff_id
      FROM visma_time vt
      JOIN clients c ON vt.client_id = c.id
      WHERE vt.id = ?
    `, [id]);
    
    if (!existingVismaTime) {
      return res.status(404).json({
        success: false,
        error: 'Visma time entry not found',
        message: 'The requested Visma time entry does not exist'
      });
    }
    
    // Check permissions
    if (user.role !== 'admin' && existingVismaTime.staff_id !== user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to update this Visma time entry'
      });
    }
    
    // Validate week ID format if provided
    if (week_id && !isValidWeekId(week_id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid week ID format',
        message: 'Week ID must be in YYYY-WXX format'
      });
    }
    
    // Check if new week_id already exists for this client
    if (week_id && week_id !== existingVismaTime.week_id) {
      const duplicateVismaTime = safeQueryOne<VismaTime>(
        'SELECT id FROM visma_time WHERE client_id = ? AND week_id = ? AND id != ?',
        [existingVismaTime.client_id, week_id, id]
      );
      
      if (duplicateVismaTime) {
        return res.status(409).json({
          success: false,
          error: 'Visma time entry already exists',
          message: 'Visma time entry already exists for this client and week'
        });
      }
    }
    
    // Build update query
    const updates: string[] = [];
    const params: any[] = [];
    
    if (week_id !== undefined) {
      updates.push('week_id = ?');
      params.push(week_id);
    }
    
    if (monday !== undefined) {
      updates.push('monday = ?');
      params.push(monday ? 1 : 0);
    }
    
    if (tuesday !== undefined) {
      updates.push('tuesday = ?');
      params.push(tuesday ? 1 : 0);
    }
    
    if (wednesday !== undefined) {
      updates.push('wednesday = ?');
      params.push(wednesday ? 1 : 0);
    }
    
    if (thursday !== undefined) {
      updates.push('thursday = ?');
      params.push(thursday ? 1 : 0);
    }
    
    if (friday !== undefined) {
      updates.push('friday = ?');
      params.push(friday ? 1 : 0);
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
    
    const query = `UPDATE visma_time SET ${updates.join(', ')} WHERE id = ?`;
    safeExecute(query, params);
    
    // Get updated Visma time entry
    const updatedVismaTime = safeQueryOne<VismaTime>(
      'SELECT * FROM visma_time WHERE id = ?',
      [id]
    );
    
    if (!updatedVismaTime) {
      throw new Error('Failed to retrieve updated Visma time entry');
    }
    
    res.json({
      success: true,
      data: updatedVismaTime
    });
    
  } catch (error) {
    console.error('Update Visma time entry error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update Visma time entry',
      message: 'An error occurred while updating the Visma time entry'
    });
  }
});

/**
 * DELETE /api/visma-time/:id
 * Delete Visma time entry
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user as JwtPayload;
    
    // Get existing Visma time entry with client info
    const existingVismaTime = safeQueryOne<VismaTime & { staff_id: string }>(
      `SELECT vt.*, c.staff_id
       FROM visma_time vt
       JOIN clients c ON vt.client_id = c.id
       WHERE vt.id = ?`,
      [id]
    );
    
    if (!existingVismaTime) {
      return res.status(404).json({
        success: false,
        error: 'Visma time entry not found',
        message: 'The requested Visma time entry does not exist'
      });
    }
    
    // Check permissions
    if (user.role !== 'admin' && existingVismaTime.staff_id !== user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to delete this Visma time entry'
      });
    }
    
    // Delete Visma time entry
    safeExecute('DELETE FROM visma_time WHERE id = ?', [id]);
    
    res.json({
      success: true,
      data: {
        message: 'Visma time entry deleted successfully'
      }
    });
    
  } catch (error) {
    console.error('Delete Visma time entry error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete Visma time entry',
      message: 'An error occurred while deleting the Visma time entry'
    });
  }
});

export default router;










