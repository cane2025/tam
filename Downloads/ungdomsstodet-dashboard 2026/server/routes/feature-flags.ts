/**
 * Feature Flags API Routes
 * Provides management interface for feature flags
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import FeatureFlagManager, { type FeatureFlag } from '../utils/feature-flags.js';
import type { JwtPayload } from '../types/database.js';

const router = Router();

// Get feature flag manager instance
let featureFlagManager: FeatureFlagManager;

export function initializeFeatureFlagRoutes(db: any) {
  featureFlagManager = new FeatureFlagManager(db);
  return router;
}

// Middleware to ensure user is admin
function requireAdmin(req: Request, res: Response, next: Function) {
  const user = (req as any).user as JwtPayload;
  if (user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      message: 'Only administrators can manage feature flags'
    });
  }
  next();
}

// Evaluate a feature flag for the current user
router.get('/evaluate/:flagName', (req: Request, res: Response) => {
  try {
    const { flagName } = req.params;
    const user = (req as any).user as JwtPayload;
    const environment = process.env.NODE_ENV || 'development';

    const evaluation = featureFlagManager.evaluateFlag(
      flagName,
      user?.userId,
      user?.role,
      environment
    );

    res.json({
      success: true,
      data: evaluation
    });
  } catch (error) {
    console.error('Failed to evaluate feature flag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to evaluate feature flag',
      message: 'An error occurred while evaluating the feature flag'
    });
  }
});

// Evaluate multiple feature flags
router.post('/evaluate', (req: Request, res: Response) => {
  try {
    const { flagNames } = req.body;
    const user = (req as any).user as JwtPayload;
    const environment = process.env.NODE_ENV || 'development';

    if (!Array.isArray(flagNames)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'flagNames must be an array'
      });
    }

    const evaluations = flagNames.map((flagName: string) =>
      featureFlagManager.evaluateFlag(flagName, user?.userId, user?.role, environment)
    );

    res.json({
      success: true,
      data: evaluations
    });
  } catch (error) {
    console.error('Failed to evaluate feature flags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to evaluate feature flags',
      message: 'An error occurred while evaluating the feature flags'
    });
  }
});

// Get all feature flags (admin only)
router.get('/', requireAdmin, (req: Request, res: Response) => {
  try {
    const environment = req.query.environment as string;
    const flags = environment 
      ? featureFlagManager.getFlagsForEnvironment(environment)
      : featureFlagManager.getAllFlags();

    res.json({
      success: true,
      data: {
        flags,
        count: flags.length
      }
    });
  } catch (error) {
    console.error('Failed to get feature flags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve feature flags',
      message: 'An error occurred while fetching feature flags'
    });
  }
});

// Get a specific feature flag (admin only)
router.get('/:flagName', requireAdmin, (req: Request, res: Response) => {
  try {
    const { flagName } = req.params;
    const flags = featureFlagManager.getAllFlags();
    const flag = flags.find(f => f.name === flagName);

    if (!flag) {
      return res.status(404).json({
        success: false,
        error: 'Feature flag not found',
        message: `Feature flag '${flagName}' does not exist`
      });
    }

    res.json({
      success: true,
      data: flag
    });
  } catch (error) {
    console.error('Failed to get feature flag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve feature flag',
      message: 'An error occurred while fetching the feature flag'
    });
  }
});

// Create a new feature flag (admin only)
router.post('/', requireAdmin, (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JwtPayload;
    const {
      name,
      description,
      enabled = false,
      rolloutPercentage = 0,
      targetUsers = [],
      targetRoles = [],
      environment = 'all',
      expiresAt,
      metadata = {}
    } = req.body;

    if (!name || !description) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Name and description are required'
      });
    }

    // Check if flag already exists
    const existingFlags = featureFlagManager.getAllFlags();
    if (existingFlags.find(f => f.name === name)) {
      return res.status(409).json({
        success: false,
        error: 'Feature flag already exists',
        message: `Feature flag '${name}' already exists`
      });
    }

    const newFlag = featureFlagManager.createFlag({
      name,
      description,
      enabled,
      rolloutPercentage,
      targetUsers,
      targetRoles,
      environment,
      createdBy: user.userId,
      expiresAt,
      metadata
    });

    res.status(201).json({
      success: true,
      data: newFlag
    });
  } catch (error) {
    console.error('Failed to create feature flag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create feature flag',
      message: 'An error occurred while creating the feature flag'
    });
  }
});

// Update a feature flag (admin only)
router.put('/:flagName', requireAdmin, (req: Request, res: Response) => {
  try {
    const { flagName } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated
    delete updates.id;
    delete updates.createdAt;
    delete updates.createdBy;

    const updatedFlag = featureFlagManager.updateFlag(flagName, updates);

    if (!updatedFlag) {
      return res.status(404).json({
        success: false,
        error: 'Feature flag not found',
        message: `Feature flag '${flagName}' does not exist`
      });
    }

    res.json({
      success: true,
      data: updatedFlag
    });
  } catch (error) {
    console.error('Failed to update feature flag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update feature flag',
      message: 'An error occurred while updating the feature flag'
    });
  }
});

// Delete a feature flag (admin only)
router.delete('/:flagName', requireAdmin, (req: Request, res: Response) => {
  try {
    const { flagName } = req.params;
    const deleted = featureFlagManager.deleteFlag(flagName);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Feature flag not found',
        message: `Feature flag '${flagName}' does not exist`
      });
    }

    res.json({
      success: true,
      data: {
        message: `Feature flag '${flagName}' deleted successfully`
      }
    });
  } catch (error) {
    console.error('Failed to delete feature flag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete feature flag',
      message: 'An error occurred while deleting the feature flag'
    });
  }
});

// Refresh feature flags cache (admin only)
router.post('/refresh', requireAdmin, (req: Request, res: Response) => {
  try {
    featureFlagManager.refreshCache();
    
    res.json({
      success: true,
      data: {
        message: 'Feature flags cache refreshed successfully'
      }
    });
  } catch (error) {
    console.error('Failed to refresh feature flags cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh cache',
      message: 'An error occurred while refreshing the feature flags cache'
    });
  }
});

export default router;
