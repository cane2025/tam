/**
 * Client Routes
 * Handles client CRUD operations
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { safeQuery, safeQueryOne, safeExecute } from '../database/connection.js';
import { nowInStockholm } from '../utils/timezone.js';
import type { 
  Client, 
  ClientWithRelations, 
  CreateClientRequest, 
  PaginatedResponse,
  JwtPayload,
  CarePlan,
  WeeklyDoc,
  MonthlyReport,
  VismaTime 
} from '../types/database.js';

const router = Router();

/**
 * GET /api/clients
 * Get all clients for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const user = req.user as JwtPayload;
    const { page = 1, limit = 50, search } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    
    let query = `
      SELECT c.*, u.name as staff_name
      FROM clients c
      JOIN users u ON c.staff_id = u.id
      WHERE c.staff_id = ?
    `;
    const params: (string | number)[] = [user.userId];
    
    if (search) {
      query += ` AND (c.name LIKE ? OR c.initials LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ` ORDER BY c.name ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);
    
    const clients = safeQuery<Client & { staff_name: string }>(query, params);
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM clients c
      WHERE c.staff_id = ?
    `;
    const countParams: (string | number)[] = [user.userId];
    
    if (search) {
      countQuery += ` AND (c.name LIKE ? OR c.initials LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
    }
    
    const totalResult = safeQueryOne<{ total: number }>(countQuery, countParams);
    const total = totalResult?.total || 0;
    
    const response: PaginatedResponse<Client & { staff_name: string }> = {
      data: clients,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    };
    
    res.json({
      success: true,
      data: response
    });
    
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch clients',
      message: 'An error occurred while fetching clients'
    });
  }
});

/**
 * GET /api/clients/all
 * Get all clients (admin only)
 */
router.get('/all', async (req, res) => {
  try {
    const user = req.user as JwtPayload;
    
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        message: 'Only administrators can view all clients'
      });
    }
    
    const { page = 1, limit = 50, search, staff_id } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let query = `
      SELECT c.*, u.name as staff_name
      FROM clients c
      JOIN users u ON c.staff_id = u.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    
    if (staff_id) {
      query += ` AND c.staff_id = ?`;
      params.push(String(staff_id));
    }
    
    if (search) {
      query += ` AND (c.name LIKE ? OR c.initials LIKE ? OR u.name LIKE ?)`;
      params.push(`%${String(search)}%`, `%${String(search)}%`, `%${String(search)}%`);
    }
    
    query += ` ORDER BY c.name ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);
    
    const clients = safeQuery<Client & { staff_name: string }>(query, params);
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM clients c
      JOIN users u ON c.staff_id = u.id
      WHERE 1=1
    `;
    const countParams: (string | number)[] = [];
    
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
    
    const response: PaginatedResponse<Client & { staff_name: string }> = {
      data: clients,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    };
    
    res.json({
      success: true,
      data: response
    });
    
  } catch (error) {
    console.error('Get all clients error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch clients',
      message: 'An error occurred while fetching clients'
    });
  }
});

/**
 * GET /api/clients/:id
 * Get client by ID with all related data
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user as JwtPayload;
    
    // Get client
    const client = safeQueryOne<Client>(
      'SELECT * FROM clients WHERE id = ?',
      [id]
    );
    
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found',
        message: 'The requested client does not exist'
      });
    }
    
    // Check permissions
    if (user.role !== 'admin' && client.staff_id !== user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to view this client'
      });
    }
    
    // Get care plan
    const carePlan = safeQueryOne<CarePlan>(
      'SELECT * FROM care_plans WHERE client_id = ?',
      [id]
    );
    
    // Get weekly docs
    const weeklyDocs = safeQuery<WeeklyDoc>(
      'SELECT * FROM weekly_docs WHERE client_id = ? ORDER BY week_id DESC',
      [id]
    );
    
    // Get monthly reports
    const monthlyReports = safeQuery<MonthlyReport>(
      'SELECT * FROM monthly_reports WHERE client_id = ? ORDER BY month_id DESC',
      [id]
    );
    
    // Get visma time
    const vismaTime = safeQuery<VismaTime>(
      'SELECT * FROM visma_time WHERE client_id = ? ORDER BY week_id DESC',
      [id]
    );
    
    const clientWithRelations: ClientWithRelations = {
      ...client,
      care_plan: carePlan || undefined,
      weekly_docs: weeklyDocs,
      monthly_reports: monthlyReports,
      visma_time: vismaTime
    };
    
    res.json({
      success: true,
      data: clientWithRelations
    });
    
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client',
      message: 'An error occurred while fetching the client'
    });
  }
});

/**
 * POST /api/clients
 * Create new client
 */
router.post('/', async (req, res) => {
  try {
    const user = req.user as JwtPayload;
    const { initials, name, staff_id }: CreateClientRequest = req.body;
    
    // Validate input
    if (!initials || !name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Initials and name are required'
      });
    }
    
    // Determine staff_id
    const targetStaffId = staff_id || user.userId;
    
    // Check permissions
    if (user.role !== 'admin' && targetStaffId !== user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied',
        message: 'You can only create clients for yourself'
      });
    }
    
    // Check if staff exists
    const staff = safeQueryOne(
      'SELECT id FROM users WHERE id = ? AND is_active = 1',
      [targetStaffId]
    );
    
    if (!staff) {
      return res.status(400).json({
        success: false,
        error: 'Invalid staff member',
        message: 'The specified staff member does not exist'
      });
    }
    
    // Check if initials already exist for this staff member
    const existingClient = safeQueryOne(
      'SELECT id FROM clients WHERE initials = ? AND staff_id = ?',
      [initials, targetStaffId]
    );
    
    if (existingClient) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate initials',
        message: 'A client with these initials already exists for this staff member'
      });
    }
    
    // Create client
    const clientId = uuidv4();
    const now = nowInStockholm().toISOString();
    
    safeExecute(
      `INSERT INTO clients (id, initials, name, staff_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [clientId, initials, name, targetStaffId, now, now]
    );
    
    // Create empty care plan
    const carePlanId = uuidv4();
    safeExecute(
      `INSERT INTO care_plans (id, client_id, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
      [carePlanId, clientId, now, now]
    );
    
    // Get created client
    const newClient = safeQueryOne<Client>(
      'SELECT * FROM clients WHERE id = ?',
      [clientId]
    );
    
    if (!newClient) {
      throw new Error('Failed to retrieve created client');
    }
    
    res.status(201).json({
      success: true,
      data: newClient
    });
    
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create client',
      message: 'An error occurred while creating the client'
    });
  }
});

/**
 * PUT /api/clients/:id
 * Update client
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user as JwtPayload;
    const { initials, name, staff_id } = req.body;
    
    // Get existing client
    const existingClient = safeQueryOne<Client>(
      'SELECT * FROM clients WHERE id = ?',
      [id]
    );
    
    if (!existingClient) {
      return res.status(404).json({
        success: false,
        error: 'Client not found',
        message: 'The requested client does not exist'
      });
    }
    
    // Check permissions
    if (user.role !== 'admin' && existingClient.staff_id !== user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to update this client'
      });
    }
    
    // Validate input
    if (!initials || !name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Initials and name are required'
      });
    }
    
    // Determine new staff_id
    const newStaffId = staff_id || existingClient.staff_id;
    
    // Check permissions for staff change
    if (staff_id && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Permission denied',
        message: 'Only administrators can reassign clients'
      });
    }
    
    // Check if new staff exists
    if (newStaffId !== existingClient.staff_id) {
      const staff = safeQueryOne(
        'SELECT id FROM users WHERE id = ? AND is_active = 1',
        [newStaffId]
      );
      
      if (!staff) {
        return res.status(400).json({
          success: false,
          error: 'Invalid staff member',
          message: 'The specified staff member does not exist'
        });
      }
    }
    
    // Check if initials already exist for the target staff member
    if (initials !== existingClient.initials || newStaffId !== existingClient.staff_id) {
      const duplicateClient = safeQueryOne(
        'SELECT id FROM clients WHERE initials = ? AND staff_id = ? AND id != ?',
        [initials, newStaffId, id]
      );
      
      if (duplicateClient) {
        return res.status(409).json({
          success: false,
          error: 'Duplicate initials',
          message: 'A client with these initials already exists for this staff member'
        });
      }
    }
    
    // Update client
    const now = nowInStockholm().toISOString();
    
    safeExecute(
      `UPDATE clients 
       SET initials = ?, name = ?, staff_id = ?, updated_at = ?
       WHERE id = ?`,
      [initials, name, newStaffId, now, id]
    );
    
    // Get updated client
    const updatedClient = safeQueryOne<Client>(
      'SELECT * FROM clients WHERE id = ?',
      [id]
    );
    
    if (!updatedClient) {
      throw new Error('Failed to retrieve updated client');
    }
    
    res.json({
      success: true,
      data: updatedClient
    });
    
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update client',
      message: 'An error occurred while updating the client'
    });
  }
});

/**
 * DELETE /api/clients/:id
 * Delete client
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user as JwtPayload;
    
    // Get existing client
    const existingClient = safeQueryOne<Client>(
      'SELECT * FROM clients WHERE id = ?',
      [id]
    );
    
    if (!existingClient) {
      return res.status(404).json({
        success: false,
        error: 'Client not found',
        message: 'The requested client does not exist'
      });
    }
    
    // Check permissions
    if (user.role !== 'admin' && existingClient.staff_id !== user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to delete this client'
      });
    }
    
    // Delete client (cascading will handle related records)
    safeExecute('DELETE FROM clients WHERE id = ?', [id]);
    
    res.json({
      success: true,
      data: {
        message: 'Client deleted successfully'
      }
    });
    
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete client',
      message: 'An error occurred while deleting the client'
    });
  }
});

export default router;

