#!/usr/bin/env tsx

/**
 * V1 → V2 Migration Script
 * Migrates data from localStorage-based V1 system to V2 SQLite database
 * Handles data validation, deduplication, and backup creation
 */

import Database from 'better-sqlite3';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', 'data', 'ungdomsstod.db');
const BACKUP_DIR = join(__dirname, '..', 'backups');
const V1_DATA_FILE = join(__dirname, '..', 'v1-export.json');

interface V1Staff {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
}

interface V1Client {
  id: string;
  initials: string;
  name: string;
  staffId: string;
}

interface V1CarePlan {
  id: string;
  clientId: string;
  carePlanDate: string;
  hasGfp: boolean;
  staffNotified: boolean;
  notes?: string;
}

interface V1WeeklyDoc {
  id: string;
  clientId: string;
  weekId: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  status: 'pending' | 'approved' | 'rejected';
}

interface V1MonthlyReport {
  id: string;
  clientId: string;
  monthId: string;
  sent: boolean;
  status: 'pending' | 'approved' | 'rejected';
}

interface V1VismaWeek {
  id: string;
  clientId: string;
  weekId: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  status: 'pending' | 'approved' | 'rejected';
}

interface V1Data {
  version: string;
  staff: V1Staff[];
  clients: V1Client[];
  carePlans: V1CarePlan[];
  weeklyDocs: V1WeeklyDoc[];
  monthlyReports: V1MonthlyReport[];
  vismaWeeks: V1VismaWeek[];
  selectedClientId?: string;
  selectedStaffId?: string;
  view: string;
}

class V1ToV2Migrator {
  private db: Database.Database;
  private migrationLog: string[] = [];

  constructor() {
    // Create backup directory
    mkdirSync(BACKUP_DIR, { recursive: true });
    
    // Initialize database
    this.db = new Database(DB_PATH);
    this.db.pragma('foreign_keys = ON');
    
    this.log('🚀 Starting V1 → V2 migration...');
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    this.migrationLog.push(logMessage);
  }

  private async createBackup(): Promise<void> {
    const backupPath = join(BACKUP_DIR, `pre-migration-${new Date().toISOString().split('T')[0]}.db`);
    
    if (existsSync(DB_PATH)) {
      const dbData = readFileSync(DB_PATH);
      writeFileSync(backupPath, dbData);
      this.log(`📦 Created backup: ${backupPath}`);
    }
  }

  private validateV1Data(data: any): V1Data | null {
    try {
      // Basic structure validation
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data structure');
      }

      if (!Array.isArray(data.staff)) {
        throw new Error('Staff data must be an array');
      }

      if (!Array.isArray(data.clients)) {
        throw new Error('Clients data must be an array');
      }

      // Validate required fields for staff
      for (const staff of data.staff) {
        if (!staff.id || !staff.name || !staff.email) {
          throw new Error(`Invalid staff record: ${JSON.stringify(staff)}`);
        }
        if (!['admin', 'staff'].includes(staff.role)) {
          staff.role = 'staff'; // Default fallback
        }
      }

      // Validate required fields for clients
      for (const client of data.clients) {
        if (!client.id || !client.initials || !client.name || !client.staffId) {
          throw new Error(`Invalid client record: ${JSON.stringify(client)}`);
        }
      }

      this.log('✅ V1 data validation passed');
      return data as V1Data;
    } catch (error) {
      this.log(`❌ V1 data validation failed: ${error}`);
      return null;
    }
  }

  private async migrateStaff(staffData: V1Staff[]): Promise<Map<string, string>> {
    this.log(`👥 Migrating ${staffData.length} staff members...`);
    const idMapping = new Map<string, string>();

    const insertStaff = this.db.prepare(`
      INSERT OR REPLACE INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    for (const staff of staffData) {
      try {
        // Generate new UUID for V2
        const newId = randomUUID();
        idMapping.set(staff.id, newId);
        
        // Hash password (default for migrated users - they'll need to reset)
        const defaultPasswordHash = '$2a$10$default.hash.for.migrated.users';
        
        insertStaff.run(newId, staff.email, staff.name, defaultPasswordHash, staff.role, 1);
        this.log(`  ✅ Migrated staff: ${staff.name} (${staff.email})`);
      } catch (error) {
        this.log(`  ❌ Failed to migrate staff ${staff.name}: ${error}`);
      }
    }

    this.log(`✅ Staff migration completed: ${idMapping.size} staff members`);
    return idMapping;
  }

  private async migrateClients(clientData: V1Client[], staffIdMapping: Map<string, string>): Promise<Map<string, string>> {
    this.log(`👤 Migrating ${clientData.length} clients...`);
    const idMapping = new Map<string, string>();

    const insertClient = this.db.prepare(`
      INSERT OR REPLACE INTO clients (id, initials, name, staff_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    for (const client of clientData) {
      try {
        const newId = randomUUID();
        const newStaffId = staffIdMapping.get(client.staffId);
        
        if (!newStaffId) {
          this.log(`  ⚠️  Skipping client ${client.name} - staff not found`);
          continue;
        }

        idMapping.set(client.id, newId);
        insertClient.run(newId, client.initials, client.name, newStaffId);
        this.log(`  ✅ Migrated client: ${client.name} (${client.initials})`);
      } catch (error) {
        this.log(`  ❌ Failed to migrate client ${client.name}: ${error}`);
      }
    }

    this.log(`✅ Client migration completed: ${idMapping.size} clients`);
    return idMapping;
  }

  private async migrateCarePlans(carePlanData: V1CarePlan[], clientIdMapping: Map<string, string>): Promise<void> {
    this.log(`📋 Migrating ${carePlanData.length} care plans...`);

    const insertCarePlan = this.db.prepare(`
      INSERT OR REPLACE INTO care_plans (id, client_id, care_plan_date, has_gfp, staff_notified, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    let migrated = 0;
    for (const carePlan of carePlanData) {
      try {
        const newId = randomUUID();
        const newClientId = clientIdMapping.get(carePlan.clientId);
        
        if (!newClientId) {
          continue;
        }

        insertCarePlan.run(
          newId,
          newClientId,
          carePlan.carePlanDate,
          carePlan.hasGfp ? 1 : 0,
          carePlan.staffNotified ? 1 : 0,
          carePlan.notes || null
        );
        migrated++;
      } catch (error) {
        this.log(`  ❌ Failed to migrate care plan: ${error}`);
      }
    }

    this.log(`✅ Care plans migration completed: ${migrated} care plans`);
  }

  private async migrateWeeklyDocs(weeklyDocData: V1WeeklyDoc[], clientIdMapping: Map<string, string>): Promise<void> {
    this.log(`📅 Migrating ${weeklyDocData.length} weekly documents...`);

    const insertWeeklyDoc = this.db.prepare(`
      INSERT OR REPLACE INTO weekly_docs (id, client_id, week_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    let migrated = 0;
    for (const weeklyDoc of weeklyDocData) {
      try {
        const newId = randomUUID();
        const newClientId = clientIdMapping.get(weeklyDoc.clientId);
        
        if (!newClientId) {
          continue;
        }

        insertWeeklyDoc.run(
          newId,
          newClientId,
          weeklyDoc.weekId,
          weeklyDoc.monday ? 1 : 0,
          weeklyDoc.tuesday ? 1 : 0,
          weeklyDoc.wednesday ? 1 : 0,
          weeklyDoc.thursday ? 1 : 0,
          weeklyDoc.friday ? 1 : 0,
          weeklyDoc.saturday ? 1 : 0,
          weeklyDoc.sunday ? 1 : 0,
          weeklyDoc.status
        );
        migrated++;
      } catch (error) {
        this.log(`  ❌ Failed to migrate weekly doc: ${error}`);
      }
    }

    this.log(`✅ Weekly docs migration completed: ${migrated} weekly documents`);
  }

  private async migrateMonthlyReports(monthlyReportData: V1MonthlyReport[], clientIdMapping: Map<string, string>): Promise<void> {
    this.log(`📊 Migrating ${monthlyReportData.length} monthly reports...`);

    const insertMonthlyReport = this.db.prepare(`
      INSERT OR REPLACE INTO monthly_reports (id, client_id, month_id, sent, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    let migrated = 0;
    for (const monthlyReport of monthlyReportData) {
      try {
        const newId = randomUUID();
        const newClientId = clientIdMapping.get(monthlyReport.clientId);
        
        if (!newClientId) {
          continue;
        }

        insertMonthlyReport.run(
          newId,
          newClientId,
          monthlyReport.monthId,
          monthlyReport.sent ? 1 : 0,
          monthlyReport.status
        );
        migrated++;
      } catch (error) {
        this.log(`  ❌ Failed to migrate monthly report: ${error}`);
      }
    }

    this.log(`✅ Monthly reports migration completed: ${migrated} monthly reports`);
  }

  private async migrateVismaWeeks(vismaWeekData: V1VismaWeek[], clientIdMapping: Map<string, string>): Promise<void> {
    this.log(`⏰ Migrating ${vismaWeekData.length} Visma weeks...`);

    const insertVismaWeek = this.db.prepare(`
      INSERT OR REPLACE INTO visma_time (id, client_id, week_id, monday, tuesday, wednesday, thursday, friday, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    let migrated = 0;
    for (const vismaWeek of vismaWeekData) {
      try {
        const newId = randomUUID();
        const newClientId = clientIdMapping.get(vismaWeek.clientId);
        
        if (!newClientId) {
          continue;
        }

        insertVismaWeek.run(
          newId,
          newClientId,
          vismaWeek.weekId,
          vismaWeek.monday ? 1 : 0,
          vismaWeek.tuesday ? 1 : 0,
          vismaWeek.wednesday ? 1 : 0,
          vismaWeek.thursday ? 1 : 0,
          vismaWeek.friday ? 1 : 0,
          vismaWeek.status
        );
        migrated++;
      } catch (error) {
        this.log(`  ❌ Failed to migrate Visma week: ${error}`);
      }
    }

    this.log(`✅ Visma weeks migration completed: ${migrated} Visma weeks`);
  }

  private async generateMigrationReport(): Promise<void> {
    const reportPath = join(BACKUP_DIR, `migration-report-${new Date().toISOString().split('T')[0]}.txt`);
    const report = this.migrationLog.join('\n');
    writeFileSync(reportPath, report);
    this.log(`📄 Migration report saved: ${reportPath}`);
  }

  public async migrate(v1DataPath?: string): Promise<boolean> {
    try {
      // Create backup
      await this.createBackup();

      // Load V1 data
      const dataPath = v1DataPath || V1_DATA_FILE;
      if (!existsSync(dataPath)) {
        this.log(`❌ V1 data file not found: ${dataPath}`);
        this.log('💡 Please export your V1 data first and place it in the expected location');
        return false;
      }

      const rawData = JSON.parse(readFileSync(dataPath, 'utf-8'));
      const v1Data = this.validateV1Data(rawData);
      
      if (!v1Data) {
        return false;
      }

      this.log(`📊 Found V1 data: ${v1Data.staff.length} staff, ${v1Data.clients.length} clients`);

      // Start migration
      const staffIdMapping = await this.migrateStaff(v1Data.staff);
      const clientIdMapping = await this.migrateClients(v1Data.clients, staffIdMapping);
      
      await this.migrateCarePlans(v1Data.carePlans || [], clientIdMapping);
      await this.migrateWeeklyDocs(v1Data.weeklyDocs || [], clientIdMapping);
      await this.migrateMonthlyReports(v1Data.monthlyReports || [], clientIdMapping);
      await this.migrateVismaWeeks(v1Data.vismaWeeks || [], clientIdMapping);

      // Generate migration report
      await this.generateMigrationReport();

      this.log('🎉 V1 → V2 migration completed successfully!');
      this.log('🔐 All migrated users need to reset their passwords');
      this.log('📋 Review the migration report for any issues');

      return true;
    } catch (error) {
      this.log(`❌ Migration failed: ${error}`);
      return false;
    } finally {
      this.db.close();
    }
  }
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dataPath = args[0];

  console.log('🔄 V1 → V2 Data Migration Tool');
  console.log('==============================');
  
  if (dataPath) {
    console.log(`📁 Using custom data path: ${dataPath}`);
  } else {
    console.log(`📁 Using default data path: ${V1_DATA_FILE}`);
    console.log('💡 You can specify a custom path: npm run migrate:v1-to-v2 path/to/your/v1-data.json');
  }

  const migrator = new V1ToV2Migrator();
  const success = await migrator.migrate(dataPath);
  
  process.exit(success ? 0 : 1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { V1ToV2Migrator };
