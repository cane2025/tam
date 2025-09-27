/**
 * Feature Flags System
 * Provides safe rollout capabilities for new features
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetUsers: string[]; // User IDs
  targetRoles: string[]; // User roles
  environment: 'development' | 'staging' | 'production' | 'all';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  metadata: Record<string, unknown>;
}

export interface FeatureFlagEvaluation {
  flagName: string;
  enabled: boolean;
  reason: string;
  metadata?: Record<string, unknown>;
}

class FeatureFlagManager {
  private db: Database.Database;
  private cache: Map<string, FeatureFlag> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(db: Database.Database) {
    this.db = db;
    this.initializeTables();
    this.loadFlagsFromDatabase();
  }

  private initializeTables(): void {
    // Create feature_flags table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS feature_flags (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT 0,
        rollout_percentage INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
        target_users TEXT, -- JSON array of user IDs
        target_roles TEXT, -- JSON array of roles
        environment TEXT NOT NULL DEFAULT 'all' CHECK (environment IN ('development', 'staging', 'production', 'all')),
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        metadata TEXT -- JSON object
      )
    `);

    // Create index for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(name);
      CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);
      CREATE INDEX IF NOT EXISTS idx_feature_flags_environment ON feature_flags(environment);
    `);

    // Insert default feature flags
    this.insertDefaultFlags();
  }

  private insertDefaultFlags(): void {
    const defaultFlags = [
      {
        name: 'new_dashboard_ui',
        description: 'Enable the new dashboard UI design',
        enabled: false,
        rolloutPercentage: 0,
        environment: 'development' as const
      },
      {
        name: 'advanced_reporting',
        description: 'Enable advanced reporting features',
        enabled: true,
        rolloutPercentage: 100,
        environment: 'all' as const
      },
      {
        name: 'bulk_operations',
        description: 'Enable bulk operations for clients and documents',
        enabled: false,
        rolloutPercentage: 0,
        environment: 'development' as const
      },
      {
        name: 'real_time_notifications',
        description: 'Enable real-time notifications',
        enabled: true,
        rolloutPercentage: 50,
        environment: 'staging' as const
      },
      {
        name: 'audit_logs_ui',
        description: 'Enable audit logs user interface',
        enabled: true,
        rolloutPercentage: 100,
        environment: 'all' as const
      }
    ];

    const insertFlag = this.db.prepare(`
      INSERT OR IGNORE INTO feature_flags 
      (id, name, description, enabled, rollout_percentage, target_users, target_roles, environment, created_by, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const flag of defaultFlags) {
      insertFlag.run(
        randomUUID(),
        flag.name,
        flag.description,
        flag.enabled ? 1 : 0,
        flag.rolloutPercentage,
        JSON.stringify([]),
        JSON.stringify([]),
        flag.environment,
        'system',
        JSON.stringify({})
      );
    }
  }

  private loadFlagsFromDatabase(): void {
    try {
      const flags = this.db.prepare('SELECT * FROM feature_flags').all() as Array<{
        id: string;
        name: string;
        description: string;
        enabled: number;
        rollout_percentage: number;
        target_users: string;
        target_roles: string;
        environment: string;
        created_by: string;
        created_at: string;
        updated_at: string;
        expires_at: string | null;
        metadata: string;
      }>;
      
      this.cache.clear();
      this.cacheExpiry.clear();
      
      for (const flag of flags) {
        const featureFlag: FeatureFlag = {
          id: flag.id,
          name: flag.name,
          description: flag.description,
          enabled: Boolean(flag.enabled),
          rolloutPercentage: flag.rollout_percentage,
          targetUsers: JSON.parse(flag.target_users || '[]'),
          targetRoles: JSON.parse(flag.target_roles || '[]'),
          environment: flag.environment,
          createdBy: flag.created_by,
          createdAt: flag.created_at,
          updatedAt: flag.updated_at,
          expiresAt: flag.expires_at,
          metadata: JSON.parse(flag.metadata || '{}')
        };
        
        this.cache.set(flag.name, featureFlag);
        this.cacheExpiry.set(flag.name, Date.now() + this.CACHE_TTL);
      }
    } catch (error) {
      console.error('Failed to load feature flags from database:', error);
    }
  }

  private isCacheValid(flagName: string): boolean {
    const expiry = this.cacheExpiry.get(flagName);
    return expiry ? Date.now() < expiry : false;
  }

  private getFlag(flagName: string): FeatureFlag | null {
    // Check cache first
    if (this.cache.has(flagName) && this.isCacheValid(flagName)) {
      return this.cache.get(flagName)!;
    }

    // Load from database
    try {
      const flag = this.db.prepare('SELECT * FROM feature_flags WHERE name = ?').get(flagName) as {
        id: string;
        name: string;
        description: string;
        enabled: number;
        rollout_percentage: number;
        target_users: string;
        target_roles: string;
        environment: string;
        created_by: string;
        created_at: string;
        updated_at: string;
        expires_at: string | null;
        metadata: string;
      } | null;
      
      if (!flag) {
        return null;
      }

      const featureFlag: FeatureFlag = {
        id: flag.id,
        name: flag.name,
        description: flag.description,
        enabled: Boolean(flag.enabled),
        rolloutPercentage: flag.rollout_percentage,
        targetUsers: JSON.parse(flag.target_users || '[]'),
        targetRoles: JSON.parse(flag.target_roles || '[]'),
        environment: flag.environment,
        createdBy: flag.created_by,
        createdAt: flag.created_at,
        updatedAt: flag.updated_at,
        expiresAt: flag.expires_at,
        metadata: JSON.parse(flag.metadata || '{}')
      };

      // Update cache
      this.cache.set(flagName, featureFlag);
      this.cacheExpiry.set(flagName, Date.now() + this.CACHE_TTL);

      return featureFlag;
    } catch (error) {
      console.error(`Failed to load feature flag ${flagName}:`, error);
      return null;
    }
  }

  public evaluateFlag(
    flagName: string,
    userId?: string,
    userRole?: string,
    environment: string = process.env.NODE_ENV || 'development'
  ): FeatureFlagEvaluation {
    const flag = this.getFlag(flagName);
    
    if (!flag) {
      return {
        flagName,
        enabled: false,
        reason: 'Flag not found'
      };
    }

    // Check if flag is expired
    if (flag.expiresAt && new Date(flag.expiresAt) < new Date()) {
      return {
        flagName,
        enabled: false,
        reason: 'Flag expired'
      };
    }

    // Check environment
    if (flag.environment !== 'all' && flag.environment !== environment) {
      return {
        flagName,
        enabled: false,
        reason: `Environment mismatch (flag: ${flag.environment}, current: ${environment})`
      };
    }

    // Check if flag is globally disabled
    if (!flag.enabled) {
      return {
        flagName,
        enabled: false,
        reason: 'Flag globally disabled'
      };
    }

    // Check target users
    if (userId && flag.targetUsers.length > 0) {
      if (flag.targetUsers.includes(userId)) {
        return {
          flagName,
          enabled: true,
          reason: 'User in target list',
          metadata: flag.metadata
        };
      } else {
        return {
          flagName,
          enabled: false,
          reason: 'User not in target list'
        };
      }
    }

    // Check target roles
    if (userRole && flag.targetRoles.length > 0) {
      if (flag.targetRoles.includes(userRole)) {
        return {
          flagName,
          enabled: true,
          reason: 'Role in target list',
          metadata: flag.metadata
        };
      } else {
        return {
          flagName,
          enabled: false,
          reason: 'Role not in target list'
        };
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      // Generate a consistent hash for the user
      const hash = this.hashString(userId || 'anonymous');
      const userPercentage = hash % 100;
      
      if (userPercentage < flag.rolloutPercentage) {
        return {
          flagName,
          enabled: true,
          reason: `Rollout percentage: ${flag.rolloutPercentage}% (user: ${userPercentage}%)`,
          metadata: flag.metadata
        };
      } else {
        return {
          flagName,
          enabled: false,
          reason: `Rollout percentage: ${flag.rolloutPercentage}% (user: ${userPercentage}%)`
        };
      }
    }

    // Flag is enabled for everyone
    return {
      flagName,
      enabled: true,
      reason: 'Flag enabled for all users',
      metadata: flag.metadata
    };
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  public createFlag(flag: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>): FeatureFlag {
    const newFlag: FeatureFlag = {
      ...flag,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const insertFlag = this.db.prepare(`
      INSERT INTO feature_flags 
      (id, name, description, enabled, rollout_percentage, target_users, target_roles, environment, created_by, metadata, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertFlag.run(
      newFlag.id,
      newFlag.name,
      newFlag.description,
      newFlag.enabled ? 1 : 0,
      newFlag.rolloutPercentage,
      JSON.stringify(newFlag.targetUsers),
      JSON.stringify(newFlag.targetRoles),
      newFlag.environment,
      newFlag.createdBy,
      JSON.stringify(newFlag.metadata),
      newFlag.expiresAt || null
    );

    // Update cache
    this.cache.set(newFlag.name, newFlag);
    this.cacheExpiry.set(newFlag.name, Date.now() + this.CACHE_TTL);

    return newFlag;
  }

  public updateFlag(flagName: string, updates: Partial<FeatureFlag>): FeatureFlag | null {
    const flag = this.getFlag(flagName);
    if (!flag) {
      return null;
    }

    const updatedFlag: FeatureFlag = {
      ...flag,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const updateFlag = this.db.prepare(`
      UPDATE feature_flags SET
        description = ?, enabled = ?, rollout_percentage = ?, target_users = ?, 
        target_roles = ?, environment = ?, metadata = ?, expires_at = ?, updated_at = ?
      WHERE name = ?
    `);

    updateFlag.run(
      updatedFlag.description,
      updatedFlag.enabled ? 1 : 0,
      updatedFlag.rolloutPercentage,
      JSON.stringify(updatedFlag.targetUsers),
      JSON.stringify(updatedFlag.targetRoles),
      updatedFlag.environment,
      JSON.stringify(updatedFlag.metadata),
      updatedFlag.expiresAt || null,
      updatedFlag.updatedAt,
      flagName
    );

    // Update cache
    this.cache.set(flagName, updatedFlag);
    this.cacheExpiry.set(flagName, Date.now() + this.CACHE_TTL);

    return updatedFlag;
  }

  public deleteFlag(flagName: string): boolean {
    try {
      const deleteFlag = this.db.prepare('DELETE FROM feature_flags WHERE name = ?');
      const result = deleteFlag.run(flagName);
      
      // Remove from cache
      this.cache.delete(flagName);
      this.cacheExpiry.delete(flagName);
      
      return result.changes > 0;
    } catch (error) {
      console.error(`Failed to delete feature flag ${flagName}:`, error);
      return false;
    }
  }

  public getAllFlags(): FeatureFlag[] {
    return Array.from(this.cache.values());
  }

  public getFlagsForEnvironment(environment: string): FeatureFlag[] {
    return this.getAllFlags().filter(flag => 
      flag.environment === 'all' || flag.environment === environment
    );
  }

  public refreshCache(): void {
    this.loadFlagsFromDatabase();
  }
}

export default FeatureFlagManager;
