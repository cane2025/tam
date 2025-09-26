/**
 * User Routes
 * Handles user management operations
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { safeQuery, safeQueryOne, safeExecute } from '../database/connection.js';
import { nowInStockholm } from '../utils/timezone.js';
import type { User, CreateUserRequest, ApiResponse, PaginatedResponse, JwtPayload } from '../types/database.js';

const router = Router();

/**
 * GET /api/users
 * Get all users (admin only)
 */
router.get('/', async (req, res) => {
  try {
    const user = req.user as JwtPayload;
    
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        message: 'Only administrators can view all users'
      });
    }
    
    const { page = 1, limit = 50, search, role } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let query = `
      SELECT id, email, name, role, is_active, created_at, updated_at
      FROM users
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (role) {
      query += ` AND role = ?`;
      params.push(role);
    }
    
    if (search) {
      query += ` AND (name LIKE ? OR email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);
    
    const users = safeQuery<Omit<User, 'password_hash'>>(query, params);
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM users
      WHERE 1=1
    `;
    const countParams: any[] = [];
    
    if (role) {
      countQuery += ` AND role = ?`;
      countParams.push(role);
    }
    
    if (search) {
      countQuery += ` AND (name LIKE ? OR email LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
    }
    
    const totalResult = safeQueryOne<{ total: number }>(countQuery, countParams);
    const total = totalResult?.total || 0;
    
    const response: PaginatedResponse<Omit<User, 'password_hash'>> = {
      data: users,
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
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      message: 'An error occurred while fetching users'
    });
  }
});

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user as JwtPayload;
    
    // Check permissions
    if (user.role !== 'admin' && user.userId !== id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You can only view your own profile'
      });
    }
    
    const targetUser = safeQueryOne<Omit<User, 'password_hash'>>(
      `SELECT id, email, name, role, is_active, created_at, updated_at
       FROM users WHERE id = ?`,
      [id]
    );
    
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'The requested user does not exist'
      });
    }
    
    res.json({
      success: true,
      data: targetUser
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
      message: 'An error occurred while fetching the user'
    });
  }
});

/**
 * PUT /api/users/:id
 * Update user
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user as JwtPayload;
    const { name, email, role, is_active } = req.body;
    
    // Check permissions
    if (user.role !== 'admin' && user.userId !== id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You can only update your own profile'
      });
    }
    
    // Get existing user
    const existingUser = safeQueryOne<User>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'The requested user does not exist'
      });
    }
    
    // Check if email is being changed and if it's already taken
    if (email && email !== existingUser.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format',
          message: 'Please provide a valid email address'
        });
      }
      
      const existingEmail = safeQueryOne<User>(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email.toLowerCase(), id]
      );
      
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          error: 'Email already exists',
          message: 'A user with this email already exists'
        });
      }
    }
    
    // Check role change permissions
    if (role && role !== existingUser.role) {
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Permission denied',
          message: 'Only administrators can change user roles'
        });
      }
    }
    
    // Check is_active change permissions
    if (typeof is_active === 'boolean' && is_active !== existingUser.is_active) {
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Permission denied',
          message: 'Only administrators can activate/deactivate users'
        });
      }
    }
    
    // Build update query
    const updates: string[] = [];
    const params: any[] = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email.toLowerCase());
    }
    
    if (role !== undefined && user.role === 'admin') {
      updates.push('role = ?');
      params.push(role);
    }
    
    if (typeof is_active === 'boolean' && user.role === 'admin') {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
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
    
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    safeExecute(query, params);
    
    // Get updated user
    const updatedUser = safeQueryOne<Omit<User, 'password_hash'>>(
      `SELECT id, email, name, role, is_active, created_at, updated_at
       FROM users WHERE id = ?`,
      [id]
    );
    
    if (!updatedUser) {
      throw new Error('Failed to retrieve updated user');
    }
    
    res.json({
      success: true,
      data: updatedUser
    });
    
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
      message: 'An error occurred while updating the user'
    });
  }
});

/**
 * PUT /api/users/:id/password
 * Change user password
 */
router.put('/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user as JwtPayload;
    const { currentPassword, newPassword } = req.body;
    
    // Check permissions
    if (user.role !== 'admin' && user.userId !== id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You can only change your own password'
      });
    }
    
    // Validate input
    if (!newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Missing new password',
        message: 'New password is required'
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Weak password',
        message: 'Password must be at least 8 characters long'
      });
    }
    
    // Get existing user
    const existingUser = safeQueryOne<User>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'The requested user does not exist'
      });
    }
    
    // Verify current password (unless admin changing someone else's password)
    if (user.role !== 'admin' || user.userId === id) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password required',
          message: 'Current password is required to change password'
        });
      }
      
      const isValidPassword = await bcrypt.compare(currentPassword, existingUser.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid current password',
          message: 'The current password is incorrect'
        });
      }
    }
    
    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    const now = nowInStockholm().toISOString();
    safeExecute(
      'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
      [newPasswordHash, now, id]
    );
    
    res.json({
      success: true,
      data: {
        message: 'Password updated successfully'
      }
    });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password',
      message: 'An error occurred while changing the password'
    });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user (admin only)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user as JwtPayload;
    
    // Only admins can delete users
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        message: 'Only administrators can delete users'
      });
    }
    
    // Cannot delete self
    if (user.userId === id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete self',
        message: 'You cannot delete your own account'
      });
    }
    
    // Get existing user
    const existingUser = safeQueryOne<User>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'The requested user does not exist'
      });
    }
    
    // Check if user has clients
    const clientCount = safeQueryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM clients WHERE staff_id = ?',
      [id]
    );
    
    if (clientCount && clientCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: 'User has clients',
        message: 'Cannot delete user with assigned clients. Please reassign clients first.'
      });
    }
    
    // Delete user
    safeExecute('DELETE FROM users WHERE id = ?', [id]);
    
    res.json({
      success: true,
      data: {
        message: 'User deleted successfully'
      }
    });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
      message: 'An error occurred while deleting the user'
    });
  }
});

export default router;

