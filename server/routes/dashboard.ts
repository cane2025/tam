/**
 * Dashboard Routes
 * Handles dashboard KPIs and analytics
 */

import { Router } from 'express';
import { safeQuery, safeQueryOne } from '../database/connection.js';
import { nowInStockholm, getCurrentWeekId, getCurrentMonthId } from '../utils/timezone.js';
import type { 
  KPIMetrics, 
  WeeklyStats, 
  MonthlyStats, 
  JwtPayload 
} from '../types/database.js';

const router = Router();

/**
 * GET /api/dashboard/kpis
 * Get KPI metrics for dashboard
 */
router.get('/kpis', async (req, res) => {
  try {
    const user = req.user as JwtPayload;
    const currentWeek = getCurrentWeekId();
    const currentMonth = getCurrentMonthId();
    const today = nowInStockholm().toISOString().split('T')[0] as string;
    
    let kpis: KPIMetrics;
    
    if (user.role === 'admin') {
      // Admin sees all data
      const totalClients = safeQueryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM clients'
      );
      
      const totalStaff = safeQueryOne<{ count: number }>(
        "SELECT COUNT(*) as count FROM users WHERE role = 'staff' AND is_active = 1"
      );
      
      const activeCarePlans = safeQueryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM care_plans WHERE has_gfp = 1'
      );
      
      const waitingCarePlans = safeQueryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM care_plans WHERE has_gfp = 0'
      );
      
      const delayedCarePlans = safeQueryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM care_plans cp
         WHERE cp.has_gfp = 0 
         AND cp.care_plan_date IS NOT NULL 
         AND date(cp.care_plan_date, '+21 days') < ?`,
        [today]
      );
      
      const completedThisWeek = safeQueryOne<{ count: number }>(
        "SELECT COUNT(*) as count FROM weekly_docs WHERE week_id = ? AND status = 'approved'",
        [currentWeek]
      );
      
      const delayedWeeklyDocs = safeQueryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM weekly_docs wd
         WHERE wd.week_id < ? AND wd.status != 'approved'`,
        [currentWeek]
      );
      
      const delayedMonthlyReports = safeQueryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM monthly_reports mr
         WHERE mr.month_id < ? AND (mr.sent = 0 OR mr.status != 'approved')`,
        [currentMonth]
      );
      
      const delayedVismaTime = safeQueryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM visma_time vt
         WHERE vt.week_id < ? AND vt.status != 'approved'`,
        [currentWeek]
      );
      
      kpis = {
        totalClients: totalClients?.count || 0,
        totalStaff: totalStaff?.count || 0,
        activeCarePlans: activeCarePlans?.count || 0,
        waitingCarePlans: waitingCarePlans?.count || 0,
        delayedCarePlans: delayedCarePlans?.count || 0,
        completedThisWeek: completedThisWeek?.count || 0,
        delayedWeeklyDocs: delayedWeeklyDocs?.count || 0,
        delayedMonthlyReports: delayedMonthlyReports?.count || 0,
        delayedVismaTime: delayedVismaTime?.count || 0
      };
    } else {
      // Staff sees only their own data
      const totalClients = safeQueryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM clients WHERE staff_id = ?',
        [user.userId]
      );
      
      const activeCarePlans = safeQueryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM care_plans cp
         JOIN clients c ON cp.client_id = c.id
         WHERE c.staff_id = ? AND cp.has_gfp = 1`,
        [user.userId]
      );
      
      const waitingCarePlans = safeQueryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM care_plans cp
         JOIN clients c ON cp.client_id = c.id
         WHERE c.staff_id = ? AND cp.has_gfp = 0`,
        [user.userId]
      );
      
      const delayedCarePlans = safeQueryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM care_plans cp
         JOIN clients c ON cp.client_id = c.id
         WHERE c.staff_id = ? AND cp.has_gfp = 0 
         AND cp.care_plan_date IS NOT NULL 
         AND date(cp.care_plan_date, '+21 days') < ?`,
        [user.userId, today]
      );
      
      const completedThisWeek = safeQueryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM weekly_docs wd
         JOIN clients c ON wd.client_id = c.id
         WHERE c.staff_id = ? AND wd.week_id = ? AND wd.status = 'approved'`,
        [user.userId, currentWeek]
      );
      
      const delayedWeeklyDocs = safeQueryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM weekly_docs wd
         JOIN clients c ON wd.client_id = c.id
         WHERE c.staff_id = ? AND wd.week_id < ? AND wd.status != 'approved'`,
        [user.userId, currentWeek]
      );
      
      const delayedMonthlyReports = safeQueryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM monthly_reports mr
         JOIN clients c ON mr.client_id = c.id
         WHERE c.staff_id = ? AND mr.month_id < ? AND (mr.sent = 0 OR mr.status != 'approved')`,
        [user.userId, currentMonth]
      );
      
      const delayedVismaTime = safeQueryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM visma_time vt
         JOIN clients c ON vt.client_id = c.id
         WHERE c.staff_id = ? AND vt.week_id < ? AND vt.status != 'approved'`,
        [user.userId, currentWeek]
      );
      
      kpis = {
        totalClients: totalClients?.count || 0,
        totalStaff: 0, // Staff don't see total staff count
        activeCarePlans: activeCarePlans?.count || 0,
        waitingCarePlans: waitingCarePlans?.count || 0,
        delayedCarePlans: delayedCarePlans?.count || 0,
        completedThisWeek: completedThisWeek?.count || 0,
        delayedWeeklyDocs: delayedWeeklyDocs?.count || 0,
        delayedMonthlyReports: delayedMonthlyReports?.count || 0,
        delayedVismaTime: delayedVismaTime?.count || 0
      };
    }
    
    res.json({
      success: true,
      data: kpis
    });
    
  } catch (error) {
    console.error('Get KPIs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch KPIs',
      message: 'An error occurred while fetching dashboard KPIs'
    });
  }
});

/**
 * GET /api/dashboard/weekly-stats
 * Get weekly statistics
 */
router.get('/weekly-stats', async (req, res) => {
  try {
    const user = req.user as JwtPayload;
    const { weeks = 8 } = req.query;
    const limit = Math.min(Number(weeks), 52); // Max 52 weeks
    
    let query: string;
    let params: (string | number)[];
    
    if (user.role === 'admin') {
      query = `
        SELECT week_id, 
               COUNT(*) as total_docs,
               SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as completed_docs
        FROM weekly_docs 
        WHERE week_id >= (
          SELECT week_id FROM weekly_docs 
          ORDER BY week_id DESC 
          LIMIT 1 OFFSET ?
        )
        GROUP BY week_id 
        ORDER BY week_id DESC
        LIMIT ?
      `;
      params = [limit - 1, limit];
    } else {
      query = `
        SELECT wd.week_id, 
               COUNT(*) as total_docs,
               SUM(CASE WHEN wd.status = 'approved' THEN 1 ELSE 0 END) as completed_docs
        FROM weekly_docs wd
        JOIN clients c ON wd.client_id = c.id
        WHERE c.staff_id = ?
        AND wd.week_id >= (
          SELECT wd2.week_id FROM weekly_docs wd2
          JOIN clients c2 ON wd2.client_id = c2.id
          WHERE c2.staff_id = ?
          ORDER BY wd2.week_id DESC 
          LIMIT 1 OFFSET ?
        )
        GROUP BY wd.week_id 
        ORDER BY wd.week_id DESC
        LIMIT ?
      `;
      params = [user.userId, user.userId, limit - 1, limit];
    }
    
    const weeklyStats = safeQuery<WeeklyStats & { week_id: string; total_docs: number; completed_docs: number }>(query, params);
    
    const stats: WeeklyStats[] = weeklyStats.map(stat => ({
      weekId: stat.week_id,
      completedDocs: stat.completed_docs,
      totalDocs: stat.total_docs,
      completionRate: stat.total_docs > 0 ? stat.completed_docs / stat.total_docs : 0
    }));
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Get weekly stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weekly statistics',
      message: 'An error occurred while fetching weekly statistics'
    });
  }
});

/**
 * GET /api/dashboard/monthly-stats
 * Get monthly statistics
 */
router.get('/monthly-stats', async (req, res) => {
  try {
    const user = req.user as JwtPayload;
    const { months = 6 } = req.query;
    const limit = Math.min(Number(months), 24); // Max 24 months
    
    let query: string;
    let params: (string | number)[];
    
    if (user.role === 'admin') {
      query = `
        SELECT month_id, 
               COUNT(*) as total_reports,
               SUM(CASE WHEN sent = 1 THEN 1 ELSE 0 END) as sent_reports
        FROM monthly_reports 
        WHERE month_id >= (
          SELECT month_id FROM monthly_reports 
          ORDER BY month_id DESC 
          LIMIT 1 OFFSET ?
        )
        GROUP BY month_id 
        ORDER BY month_id DESC
        LIMIT ?
      `;
      params = [limit - 1, limit];
    } else {
      query = `
        SELECT mr.month_id, 
               COUNT(*) as total_reports,
               SUM(CASE WHEN mr.sent = 1 THEN 1 ELSE 0 END) as sent_reports
        FROM monthly_reports mr
        JOIN clients c ON mr.client_id = c.id
        WHERE c.staff_id = ?
        AND mr.month_id >= (
          SELECT mr2.month_id FROM monthly_reports mr2
          JOIN clients c2 ON mr2.client_id = c2.id
          WHERE c2.staff_id = ?
          ORDER BY mr2.month_id DESC 
          LIMIT 1 OFFSET ?
        )
        GROUP BY mr.month_id 
        ORDER BY mr.month_id DESC
        LIMIT ?
      `;
      params = [user.userId, user.userId, limit - 1, limit];
    }
    
    const monthlyStats = safeQuery<MonthlyStats & { month_id: string; total_reports: number; sent_reports: number }>(query, params);
    
    const stats: MonthlyStats[] = monthlyStats.map(stat => ({
      monthId: stat.month_id,
      sentReports: stat.sent_reports,
      totalReports: stat.total_reports,
      sentRate: stat.total_reports > 0 ? stat.sent_reports / stat.total_reports : 0
    }));
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Get monthly stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monthly statistics',
      message: 'An error occurred while fetching monthly statistics'
    });
  }
});

/**
 * GET /api/dashboard/recent-activity
 * Get recent activity across all modules
 */
router.get('/recent-activity', async (req, res) => {
  try {
    const user = req.user as JwtPayload;
    const { limit = 20 } = req.query;
    
    let query: string;
    let params: (string | number)[];
    
    if (user.role === 'admin') {
      query = `
        SELECT 'care_plan' as type, cp.updated_at, c.name as client_name, c.initials as client_initials, u.name as staff_name,
               'Care plan updated' as description
        FROM care_plans cp
        JOIN clients c ON cp.client_id = c.id
        JOIN users u ON c.staff_id = u.id
        
        UNION ALL
        
        SELECT 'weekly_doc' as type, wd.updated_at, c.name as client_name, c.initials as client_initials, u.name as staff_name,
               'Weekly documentation updated' as description
        FROM weekly_docs wd
        JOIN clients c ON wd.client_id = c.id
        JOIN users u ON c.staff_id = u.id
        
        UNION ALL
        
        SELECT 'monthly_report' as type, mr.updated_at, c.name as client_name, c.initials as client_initials, u.name as staff_name,
               'Monthly report updated' as description
        FROM monthly_reports mr
        JOIN clients c ON mr.client_id = c.id
        JOIN users u ON c.staff_id = u.id
        
        UNION ALL
        
        SELECT 'visma_time' as type, vt.updated_at, c.name as client_name, c.initials as client_initials, u.name as staff_name,
               'Visma time updated' as description
        FROM visma_time vt
        JOIN clients c ON vt.client_id = c.id
        JOIN users u ON c.staff_id = u.id
        
        ORDER BY updated_at DESC
        LIMIT ?
      `;
      params = [Number(limit)];
    } else {
      query = `
        SELECT 'care_plan' as type, cp.updated_at, c.name as client_name, c.initials as client_initials, u.name as staff_name,
               'Care plan updated' as description
        FROM care_plans cp
        JOIN clients c ON cp.client_id = c.id
        JOIN users u ON c.staff_id = u.id
        WHERE c.staff_id = ?
        
        UNION ALL
        
        SELECT 'weekly_doc' as type, wd.updated_at, c.name as client_name, c.initials as client_initials, u.name as staff_name,
               'Weekly documentation updated' as description
        FROM weekly_docs wd
        JOIN clients c ON wd.client_id = c.id
        JOIN users u ON c.staff_id = u.id
        WHERE c.staff_id = ?
        
        UNION ALL
        
        SELECT 'monthly_report' as type, mr.updated_at, c.name as client_name, c.initials as client_initials, u.name as staff_name,
               'Monthly report updated' as description
        FROM monthly_reports mr
        JOIN clients c ON mr.client_id = c.id
        JOIN users u ON c.staff_id = u.id
        WHERE c.staff_id = ?
        
        UNION ALL
        
        SELECT 'visma_time' as type, vt.updated_at, c.name as client_name, c.initials as client_initials, u.name as staff_name,
               'Visma time updated' as description
        FROM visma_time vt
        JOIN clients c ON vt.client_id = c.id
        JOIN users u ON c.staff_id = u.id
        WHERE c.staff_id = ?
        
        ORDER BY updated_at DESC
        LIMIT ?
      `;
      params = [user.userId, user.userId, user.userId, user.userId, Number(limit)];
    }
    
    const recentActivity = safeQuery<{
      type: string;
      updated_at: string;
      client_name: string;
      client_initials: string;
      staff_name: string;
      description: string;
    }>(query, params);
    
    res.json({
      success: true,
      data: recentActivity
    });
    
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent activity',
      message: 'An error occurred while fetching recent activity'
    });
  }
});

/**
 * GET /api/dashboard/overdue-items
 * Get overdue items that need attention
 */
router.get('/overdue-items', async (req, res) => {
  try {
    const user = req.user as JwtPayload;
    const currentWeek = getCurrentWeekId();
    const currentMonth = getCurrentMonthId();
    const today = nowInStockholm().toISOString().split('T')[0] as string;
    
    let query: string;
    let params: (string | number)[];
    
    if (user.role === 'admin') {
      query = `
        SELECT 'care_plan' as type, c.name as client_name, c.initials as client_initials, u.name as staff_name,
               cp.care_plan_date, 'Care plan overdue - GFP needed' as description
        FROM care_plans cp
        JOIN clients c ON cp.client_id = c.id
        JOIN users u ON c.staff_id = u.id
        WHERE cp.has_gfp = 0 AND cp.care_plan_date IS NOT NULL 
        AND date(cp.care_plan_date, '+21 days') < ?
        
        UNION ALL
        
        SELECT 'weekly_doc' as type, c.name as client_name, c.initials as client_initials, u.name as staff_name,
               wd.week_id, 'Weekly documentation overdue' as description
        FROM weekly_docs wd
        JOIN clients c ON wd.client_id = c.id
        JOIN users u ON c.staff_id = u.id
        WHERE wd.week_id < ? AND wd.status != 'approved'
        
        UNION ALL
        
        SELECT 'monthly_report' as type, c.name as client_name, c.initials as client_initials, u.name as staff_name,
               mr.month_id, 'Monthly report overdue' as description
        FROM monthly_reports mr
        JOIN clients c ON mr.client_id = c.id
        JOIN users u ON c.staff_id = u.id
        WHERE mr.month_id < ? AND (mr.sent = 0 OR mr.status != 'approved')
        
        UNION ALL
        
        SELECT 'visma_time' as type, c.name as client_name, c.initials as client_initials, u.name as staff_name,
               vt.week_id, 'Visma time overdue' as description
        FROM visma_time vt
        JOIN clients c ON vt.client_id = c.id
        JOIN users u ON c.staff_id = u.id
        WHERE vt.week_id < ? AND vt.status != 'approved'
        
        ORDER BY client_name
      `;
      params = [today, currentWeek, currentMonth, currentWeek];
    } else {
      query = `
        SELECT 'care_plan' as type, c.name as client_name, c.initials as client_initials, u.name as staff_name,
               cp.care_plan_date, 'Care plan overdue - GFP needed' as description
        FROM care_plans cp
        JOIN clients c ON cp.client_id = c.id
        JOIN users u ON c.staff_id = u.id
        WHERE c.staff_id = ? AND cp.has_gfp = 0 AND cp.care_plan_date IS NOT NULL 
        AND date(cp.care_plan_date, '+21 days') < ?
        
        UNION ALL
        
        SELECT 'weekly_doc' as type, c.name as client_name, c.initials as client_initials, u.name as staff_name,
               wd.week_id, 'Weekly documentation overdue' as description
        FROM weekly_docs wd
        JOIN clients c ON wd.client_id = c.id
        JOIN users u ON c.staff_id = u.id
        WHERE c.staff_id = ? AND wd.week_id < ? AND wd.status != 'approved'
        
        UNION ALL
        
        SELECT 'monthly_report' as type, c.name as client_name, c.initials as client_initials, u.name as staff_name,
               mr.month_id, 'Monthly report overdue' as description
        FROM monthly_reports mr
        JOIN clients c ON mr.client_id = c.id
        JOIN users u ON c.staff_id = u.id
        WHERE c.staff_id = ? AND mr.month_id < ? AND (mr.sent = 0 OR mr.status != 'approved')
        
        UNION ALL
        
        SELECT 'visma_time' as type, c.name as client_name, c.initials as client_initials, u.name as staff_name,
               vt.week_id, 'Visma time overdue' as description
        FROM visma_time vt
        JOIN clients c ON vt.client_id = c.id
        JOIN users u ON c.staff_id = u.id
        WHERE c.staff_id = ? AND vt.week_id < ? AND vt.status != 'approved'
        
        ORDER BY client_name
      `;
      params = [user.userId, today, user.userId, currentWeek, user.userId, currentMonth, user.userId, currentWeek];
    }
    
    const overdueItems = safeQuery<{
      type: string;
      client_name: string;
      client_initials: string;
      staff_name: string;
      date_field: string;
      description: string;
    }>(query, params);
    
    res.json({
      success: true,
      data: overdueItems
    });
    
  } catch (error) {
    console.error('Get overdue items error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch overdue items',
      message: 'An error occurred while fetching overdue items'
    });
  }
});

export default router;
