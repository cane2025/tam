#!/usr/bin/env tsx

/**
 * Simple Database Seed Script
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', 'data', 'ungdomsstod.db');

async function seedDatabase(): Promise<void> {
  console.log('🌱 Starting database seeding...');
  
  try {
    const db = new Database(DB_PATH);
    
    // Create admin user
    const adminId = uuidv4();
    const adminPasswordHash = await bcrypt.hash('admin123', 12);
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT OR REPLACE INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(adminId, 'admin@ungdomsstod.se', 'Administrator', adminPasswordHash, 'admin', 1, now, now);
    
    console.log('✅ Created admin user');
    
    // Create staff users
    const staffUsers = [
      { name: 'Anna Andersson', email: 'anna@ungdomsstod.se' },
      { name: 'Johan Johansson', email: 'johan@ungdomsstod.se' },
      { name: 'Maria Svensson', email: 'maria@ungdomsstod.se' }
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
      { initials: 'IJ', name: 'Ingrid J', staffIndex: 2 }
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
    for (let i = 0; i < clientIds.length; i++) {
      const clientId = clientIds[i];
      const carePlanId = uuidv4();
      
      const hasCarePlan = i < 3;
      const carePlanDate = hasCarePlan ? '2024-01-15' : null;
      const hasGFP = i < 2;
      const staffNotified = i < 4;
      
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
    
    db.close();
    
    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Sample data created:');
    console.log('- 1 admin user (admin@ungdomsstod.se / admin123)');
    console.log('- 3 staff users (staff@ungdomsstod.se / staff123)');
    console.log('- 5 clients distributed among staff');
    console.log('- Care plans (some with GFP, some pending)');
    console.log('\n🔑 Login credentials:');
    console.log('- Admin: admin@ungdomsstod.se / admin123');
    console.log('- Staff: anna@ungdomsstod.se / staff123');
    console.log('- Staff: johan@ungdomsstod.se / staff123');
    console.log('- Staff: maria@ungdomsstod.se / staff123');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Run seeding
seedDatabase().catch(error => {
  console.error('Failed to seed database:', error);
  process.exit(1);
});






