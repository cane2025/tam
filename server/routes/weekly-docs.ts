/**
 * Weekly Documentation API Routes
 * Handle CRUD operations for weekly documentation
 */

import express from 'express';
import { getDb } from '../database/connection.js';
import { nowInStockholm } from '../utils/timezone.js';
import type { CreateWeeklyDocRequest, UpdateWeeklyDocRequest } from '../types/database.js';

const router = express.Router();

// Get all weekly docs for a client
router.get('/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { week_id } = req.query;
    
    const db = getDb();
    let query = 'SELECT * FROM weekly_docs WHERE client_id = ?';
    const params = [clientId];
    
    if (week_id) {
      query += ' AND week_id = ?';
      params.push(week_id as string);
    }
    
    query += ' ORDER BY week_id DESC';
    
    const weeklyDocs = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: weeklyDocs
    });
  } catch (error) {
    console.error('Error fetching weekly docs:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Failed to fetch weekly documentation'
    });
  }
});

// Get weekly docs for a staff member
router.get('/staff/:staffId', async (req, res) => {
  try {
    const { staffId } = req.params;
    const { week_id } = req.query;
    
    const db = getDb();
    let query = `
      SELECT wd.*, c.name as client_name, c.initials as client_initials
      FROM weekly_docs wd
      JOIN clients c ON wd.client_id = c.id
      WHERE c.assigned_staff_id = ?
    `;
    const params = [staffId];
    
    if (week_id) {
      query += ' AND wd.week_id = ?';
      params.push(week_id as string);
    }
    
    query += ' ORDER BY wd.week_id DESC, c.name ASC';
    
    const weeklyDocs = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: weeklyDocs
    });
  } catch (error) {
    console.error('Error fetching staff weekly docs:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Failed to fetch weekly documentation'
    });
  }
});

// Get a specific weekly doc
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const weeklyDoc = db.prepare(`
      SELECT wd.*, c.name as client_name, c.initials as client_initials
      FROM weekly_docs wd
      JOIN clients c ON wd.client_id = c.id
      WHERE wd.id = ?
    `).get(id);

    if (!weeklyDoc) {
      return res.status(404).json({
        success: false,
        error: 'Weekly documentation not found',
        message: 'The requested weekly documentation does not exist'
      });
    }

    res.json({
      success: true,
      data: weeklyDoc
    });
  } catch (error) {
    console.error('Error fetching weekly doc:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Failed to fetch weekly documentation'
    });
  }
});

// Create a new weekly doc
router.post('/', async (req, res) => {
  try {
    const { 
      client_id, 
      week_id, 
      monday, 
      tuesday, 
      wednesday, 
      thursday, 
      friday, 
      saturday, 
      sunday,
      notes,
      status = 'pending'
    } = req.body as CreateWeeklyDocRequest;
    
    if (!client_id || !week_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Client ID and week ID are required'
      });
    }

    const db = getDb();
    const now = nowInStockholm().toISOString();
    
    // Check if weekly doc already exists for this client and week
    const existing = db.prepare(
      'SELECT id FROM weekly_docs WHERE client_id = ? AND week_id = ?'
    ).get(client_id, week_id);
    
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Weekly documentation already exists',
        message: 'Weekly documentation for this client and week already exists'
      });
    }
    
    const result = db.prepare(`
      INSERT INTO weekly_docs (
        client_id, week_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
        notes, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      client_id, week_id, 
      monday || false, tuesday || false, wednesday || false, thursday || false, friday || false,
      saturday || false, sunday || false,
      notes || '', status, now, now
    );

    const weeklyDoc = db.prepare(`
      SELECT wd.*, c.name as client_name, c.initials as client_initials
      FROM weekly_docs wd
      JOIN clients c ON wd.client_id = c.id
      WHERE wd.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: weeklyDoc,
      message: 'Weekly documentation created successfully'
    });
  } catch (error) {
    console.error('Error creating weekly doc:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Failed to create weekly documentation'
    });
  }
});

// Update a weekly doc
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body as UpdateWeeklyDocRequest;
    
    const db = getDb();
    const now = nowInStockholm().toISOString();
    
    // Check if weekly doc exists
    const existing = db.prepare('SELECT id FROM weekly_docs WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Weekly documentation not found',
        message: 'The requested weekly documentation does not exist'
      });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    
    const booleanFields = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const stringFields = ['notes', 'status'];
    
    booleanFields.forEach(field => {
      if (updates[field as keyof UpdateWeeklyDocRequest] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field as keyof UpdateWeeklyDocRequest]);
      }
    });
    
    stringFields.forEach(field => {
      if (updates[field as keyof UpdateWeeklyDocRequest] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field as keyof UpdateWeeklyDocRequest]);
      }
    });
    
    updateFields.push('updated_at = ?');
    updateValues.push(now);
    updateValues.push(id);
    
    db.prepare(`
      UPDATE weekly_docs 
      SET ${updateFields.join(', ')} 
      WHERE id = ?
    `).run(...updateValues);

    const weeklyDoc = db.prepare(`
      SELECT wd.*, c.name as client_name, c.initials as client_initials
      FROM weekly_docs wd
      JOIN clients c ON wd.client_id = c.id
      WHERE wd.id = ?
    `).get(id);

    res.json({
      success: true,
      data: weeklyDoc,
      message: 'Weekly documentation updated successfully'
    });
  } catch (error) {
    console.error('Error updating weekly doc:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Failed to update weekly documentation'
    });
  }
});

// Delete a weekly doc
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const result = db.prepare('DELETE FROM weekly_docs WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Weekly documentation not found',
        message: 'The requested weekly documentation does not exist'
      });
    }

    res.json({
      success: true,
      message: 'Weekly documentation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting weekly doc:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Failed to delete weekly documentation'
    });
  }
});

export default router;

