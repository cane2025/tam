/**
 * Care Plans API Routes
 * Handle CRUD operations for care plans
 */

import express from 'express';
import { getDb } from '../database/connection.js';
import { nowInStockholm } from '../utils/timezone.js';
import type { CreateCarePlanRequest, UpdateCarePlanRequest } from '../types/database.js';

const router = express.Router();

// Get all care plans for a client
router.get('/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const db = getDb();
    
    const carePlans = db.prepare(`
      SELECT * FROM care_plans 
      WHERE client_id = ? 
      ORDER BY created_at DESC
    `).all(clientId);

    res.json({
      success: true,
      data: carePlans
    });
  } catch (error) {
    console.error('Error fetching care plans:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Failed to fetch care plans'
    });
  }
});

// Get care plans for a staff member
router.get('/staff/:staffId', async (req, res) => {
  try {
    const { staffId } = req.params;
    const db = getDb();
    
    const carePlans = db.prepare(`
      SELECT cp.*, c.name as client_name, c.initials as client_initials
      FROM care_plans cp
      JOIN clients c ON cp.client_id = c.id
      WHERE c.assigned_staff_id = ?
      ORDER BY cp.created_at DESC
    `).all(staffId);

    res.json({
      success: true,
      data: carePlans
    });
  } catch (error) {
    console.error('Error fetching staff care plans:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Failed to fetch care plans'
    });
  }
});

// Get a specific care plan
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const carePlan = db.prepare(`
      SELECT cp.*, c.name as client_name, c.initials as client_initials
      FROM care_plans cp
      JOIN clients c ON cp.client_id = c.id
      WHERE cp.id = ?
    `).get(id);

    if (!carePlan) {
      return res.status(404).json({
        success: false,
        error: 'Care plan not found',
        message: 'The requested care plan does not exist'
      });
    }

    res.json({
      success: true,
      data: carePlan
    });
  } catch (error) {
    console.error('Error fetching care plan:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Failed to fetch care plan'
    });
  }
});

// Create a new care plan
router.post('/', async (req, res) => {
  try {
    const { client_id, plan_date, goals, interventions, notes } = req.body as CreateCarePlanRequest;
    
    if (!client_id || !plan_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Client ID and plan date are required'
      });
    }

    const db = getDb();
    const now = nowInStockholm().toISOString();
    
    const result = db.prepare(`
      INSERT INTO care_plans (client_id, plan_date, goals, interventions, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(client_id, plan_date, goals || '', interventions || '', notes || '', now, now);

    const carePlan = db.prepare(`
      SELECT cp.*, c.name as client_name, c.initials as client_initials
      FROM care_plans cp
      JOIN clients c ON cp.client_id = c.id
      WHERE cp.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: carePlan,
      message: 'Care plan created successfully'
    });
  } catch (error) {
    console.error('Error creating care plan:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Failed to create care plan'
    });
  }
});

// Update a care plan
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body as UpdateCarePlanRequest;
    
    const db = getDb();
    const now = nowInStockholm().toISOString();
    
    // Check if care plan exists
    const existing = db.prepare('SELECT id FROM care_plans WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Care plan not found',
        message: 'The requested care plan does not exist'
      });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    
    if (updates.plan_date !== undefined) {
      updateFields.push('plan_date = ?');
      updateValues.push(updates.plan_date);
    }
    if (updates.goals !== undefined) {
      updateFields.push('goals = ?');
      updateValues.push(updates.goals);
    }
    if (updates.interventions !== undefined) {
      updateFields.push('interventions = ?');
      updateValues.push(updates.interventions);
    }
    if (updates.notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(updates.notes);
    }
    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(updates.status);
    }
    
    updateFields.push('updated_at = ?');
    updateValues.push(now);
    updateValues.push(id);
    
    db.prepare(`
      UPDATE care_plans 
      SET ${updateFields.join(', ')} 
      WHERE id = ?
    `).run(...updateValues);

    const carePlan = db.prepare(`
      SELECT cp.*, c.name as client_name, c.initials as client_initials
      FROM care_plans cp
      JOIN clients c ON cp.client_id = c.id
      WHERE cp.id = ?
    `).get(id);

    res.json({
      success: true,
      data: carePlan,
      message: 'Care plan updated successfully'
    });
  } catch (error) {
    console.error('Error updating care plan:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Failed to update care plan'
    });
  }
});

// Delete a care plan
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const result = db.prepare('DELETE FROM care_plans WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Care plan not found',
        message: 'The requested care plan does not exist'
      });
    }

    res.json({
      success: true,
      message: 'Care plan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting care plan:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Failed to delete care plan'
    });
  }
});

export default router;

