/**
 * Database Types
 * TypeScript interfaces for all database entities
 */

export type DocStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'admin' | 'staff';
export type WeekId = string; // Format: 'YYYY-WXX'
export type MonthId = string; // Format: 'YYYY-MM'

// Database entity interfaces
export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  initials: string;
  name: string;
  staff_id: string;
  created_at: string;
  updated_at: string;
}

export interface CarePlan {
  id: string;
  client_id: string;
  care_plan_date: string | null;
  has_gfp: boolean;
  staff_notified: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyDoc {
  id: string;
  client_id: string;
  week_id: WeekId;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  status: DocStatus;
  created_at: string;
  updated_at: string;
}

export interface MonthlyReport {
  id: string;
  client_id: string;
  month_id: MonthId;
  sent: boolean;
  status: DocStatus;
  created_at: string;
  updated_at: string;
}

export interface VismaTime {
  id: string;
  client_id: string;
  week_id: WeekId;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  status: DocStatus;
  created_at: string;
  updated_at: string;
}

export interface IdempotencyKey {
  key: string;
  operation: string;
  request_hash: string;
  response: string | null;
  created_at: string;
  expires_at: string;
}

// Extended interfaces with relationships
export interface ClientWithRelations extends Client {
  care_plan?: CarePlan;
  weekly_docs: WeeklyDoc[];
  monthly_reports: MonthlyReport[];
  visma_time: VismaTime[];
}

export interface UserWithClients extends User {
  clients: ClientWithRelations[];
}

// API request/response types
export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
}

export interface CreateClientRequest {
  initials: string;
  name: string;
  staff_id: string;
}

export interface UpdateCarePlanRequest {
  care_plan_date?: string;
  plan_date?: string;
  has_gfp?: boolean;
  staff_notified?: boolean;
  notes?: string;
  goals?: string;
  interventions?: string;
  status?: DocStatus;
}

export interface CreateCarePlanRequest {
  client_id: string;
  plan_date: string;
  goals?: string;
  interventions?: string;
  notes?: string;
  status?: DocStatus;
}

export interface CreateWeeklyDocRequest {
  client_id: string;
  week_id: WeekId;
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
  notes?: string;
  status?: DocStatus;
}

export interface UpdateWeeklyDocRequest {
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
  notes?: string;
  status?: DocStatus;
}

export interface CreateMonthlyReportRequest {
  month_id: MonthId;
  sent?: boolean;
  status?: DocStatus;
}

export interface CreateVismaTimeRequest {
  week_id: WeekId;
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  status?: DocStatus;
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: Omit<User, 'password_hash'>;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

// KPI and dashboard types
export interface KPIMetrics {
  totalClients: number;
  totalStaff: number;
  activeCarePlans: number;
  waitingCarePlans: number;
  delayedCarePlans: number;
  completedThisWeek: number;
  delayedWeeklyDocs: number;
  delayedMonthlyReports: number;
  delayedVismaTime: number;
}

export interface WeeklyStats {
  weekId: WeekId;
  completedDocs: number;
  totalDocs: number;
  completionRate: number;
}

export interface MonthlyStats {
  monthId: MonthId;
  sentReports: number;
  totalReports: number;
  sentRate: number;
}

