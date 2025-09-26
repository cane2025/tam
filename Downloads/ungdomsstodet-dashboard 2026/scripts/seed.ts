#!/usr/bin/env tsx

/**
 * Database Seed Script
 * Populates database with sample data for development and testing
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../server/database/connection.js';
import { nowInStockholm, getCurrentWeekId, getCurrentMonthId } from '../server/utils/timezone.js';

const db = getDatabase();

async function seedDatabase(): Promise<void> {
  console.log('🌱 Starting database seeding...');
  
  try {
    // Create admin user
    const adminId = uuidv4();
    const adminPasswordHash = await bcrypt.hash('admin123', 12);
    const now = nowInStockholm().toISOString();
    
    db.prepare(`
      INSERT OR REPLACE INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(adminId, 'admin@ungdomsstod.se', 'Administrator', adminPasswordHash, 'admin', 1, now, now);
    
    console.log('✅ Created admin user');
    
    // Create staff users
    const staffUsers = [
      { name: 'Anna Andersson', email: 'anna@ungdomsstod.se' },
      { name: 'Johan Johansson', email: 'johan@ungdomsstod.se' },
      { name: 'Maria Svensson', email: 'maria@ungdomsstod.se' },
      { name: 'Erik Nilsson', email: 'erik@ungdomsstod.se' }
    ];
    
    const staffIds: string[] = [];
    const staffPasswordHash = await bcrypt.hash('staff123', 12);
    
    for (const staff of staffUsers) {
      const staffId = uuidv4();
      db.prepare(`
        INSERT OR REPLACE INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(staffId, staff.email, staff.name, staffPasswordHash, 'staff', 1, now, now);
      
      staffIds.push(staffId);
      console.log(`✅ Created staff user: ${staff.name}`);
    }
    
    // Create sample clients
    const clientData = [
      { initials: 'AB', name: 'Anna B', staffIndex: 0 },
      { initials: 'CD', name: 'Carl D', staffIndex: 0 },
      { initials: 'EF', name: 'Erik F', staffIndex: 1 },
      { initials: 'GH', name: 'Greta H', staffIndex: 1 },
      { initials: 'IJ', name: 'Ingrid J', staffIndex: 2 },
      { initials: 'KL', name: 'Kalle L', staffIndex: 2 },
      { initials: 'MN', name: 'Maja N', staffIndex: 3 },
      { initials: 'OP', name: 'Olle P', staffIndex: 3 }
    ];
    
    const clientIds: string[] = [];
    
    for (const client of clientData) {
      const clientId = uuidv4();
      const staffId = staffIds[client.staffIndex];
      
      db.prepare(`
        INSERT OR REPLACE INTO clients (id, initials, name, staff_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(clientId, client.initials, client.name, staffId, now, now);
      
      clientIds.push(clientId);
      console.log(`✅ Created client: ${client.initials} (${client.name})`);
    }
    
    // Create care plans
    const currentWeek = getCurrentWeekId();
    const currentMonth = getCurrentMonthId();
    
    for (let i = 0; i < clientIds.length; i++) {
      const clientId = clientIds[i];
      const carePlanId = uuidv4();
      
      // Some clients have care plans, some don't
      const hasCarePlan = i < 6;
      const carePlanDate = hasCarePlan ? '2024-01-15' : null;
      const hasGFP = i < 4; // First 4 have GFP
      const staffNotified = i < 5; // First 5 have staff notified
      
      db.prepare(`
        INSERT OR REPLACE INTO care_plans (id, client_id, care_plan_date, has_gfp, staff_notified, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        carePlanId,
        clientId,
        carePlanDate,
        hasGFP ? 1 : 0,
        staffNotified ? 1 : 0,
        hasCarePlan ? `Care plan notes for client ${i + 1}` : null,
        now,
        now
      );
      
      console.log(`✅ Created care plan for client ${i + 1}`);
    }
    
    // Create weekly documentation
    const weekIds = ['2024-W01', '2024-W02', '2024-W03', currentWeek];
    
    for (let i = 0; i < clientIds.length; i++) {
      const clientId = clientIds[i];
      
      for (let j = 0; j < weekIds.length; j++) {
        const weekId = weekIds[j];
        const weeklyDocId = uuidv4();
        
        // Some weeks have documentation
        const hasDocs = j < 3 || (j === 3 && i < 4);
        const status = hasDocs ? (i < 2 ? 'approved' : 'pending') : 'pending';
        
        db.prepare(`
          INSERT OR REPLACE INTO weekly_docs (
            id, client_id, week_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, status, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          weeklyDocId,
          clientId,
          weekId,
          hasDocs && i % 2 === 0 ? 1 : 0,
          hasDocs ? 1 : 0,
          hasDocs && i % 3 === 0 ? 1 : 0,
          hasDocs ? 1 : 0,
          hasDocs && i % 2 === 1 ? 1 : 0,
          0, // Saturday
          0, // Sunday
          status,
          now,
          now
        );
      }
      
      console.log(`✅ Created weekly docs for client ${i + 1}`);
    }
    
    // Create monthly reports
    const monthIds = ['2024-01', '2024-02', currentMonth];
    
    for (let i = 0; i < clientIds.length; i++) {
      const clientId = clientIds[i];
      
      for (let j = 0; j < monthIds.length; j++) {
        const monthId = monthIds[j];
        const monthlyReportId = uuidv4();
        
        // Some months have reports
        const hasReport = j < 2 || (j === 2 && i < 6);
        const sent = hasReport && i < 4;
        const status = hasReport ? (i < 3 ? 'approved' : 'pending') : 'pending';
        
        db.prepare(`
          INSERT OR REPLACE INTO monthly_reports (id, client_id, month_id, sent, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          monthlyReportId,
          clientId,
          monthId,
          sent ? 1 : 0,
          status,
          now,
          now
        );
      }
      
      console.log(`✅ Created monthly reports for client ${i + 1}`);
    }
    
    // Create Visma time entries
    for (let i = 0; i < clientIds.length; i++) {
      const clientId = clientIds[i];
      
      for (let j = 0; j < weekIds.length; j++) {
        const weekId = weekIds[j];
        const vismaTimeId = uuidv4();
        
        // Some weeks have Visma time
        const hasTime = j < 3 || (j === 3 && i < 5);
        const status = hasTime ? (i < 2 ? 'approved' : 'pending') : 'pending';
        
        db.prepare(`
          INSERT OR REPLACE INTO visma_time (
            id, client_id, week_id, monday, tuesday, wednesday, thursday, friday, status, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          vismaTimeId,
          clientId,
          weekId,
          hasTime && i % 2 === 0 ? 1 : 0,
          hasTime ? 1 : 0,
          hasTime && i % 3 === 0 ? 1 : 0,
          hasTime ? 1 : 0,
          hasTime && i % 2 === 1 ? 1 : 0,
          status,
          now,
          now
        );
      }
      
      console.log(`✅ Created Visma time for client ${i + 1}`);
    }
    
    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Sample data created:');
    console.log('- 1 admin user (admin@ungdomsstod.se / admin123)');
    console.log('- 4 staff users (staff@ungdomsstod.se / staff123)');
    console.log('- 8 clients distributed among staff');
    console.log('- Care plans (some with GFP, some pending)');
    console.log('- Weekly documentation for multiple weeks');
    console.log('- Monthly reports for multiple months');
    console.log('- Visma time entries for multiple weeks');
    console.log('\n🔑 Login credentials:');
    console.log('- Admin: admin@ungdomsstod.se / admin123');
    console.log('- Staff: anna@ungdomsstod.se / staff123');
    console.log('- Staff: johan@ungdomsstod.se / staff123');
    console.log('- Staff: maria@ungdomsstod.se / staff123');
    console.log('- Staff: erik@ungdomsstod.se / staff123');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase().catch(error => {
    console.error('Failed to seed database:', error);
    process.exit(1);
  });
}

export { seedDatabase };






