/**
 * Typdefinitioner för Ungdomsstöd Admin
 * Enligt projektregler: dessa typer får INTE brytas
 */

export type DocStatus = 'approved' | 'pending' | 'rejected';
export type WeekId = string; // 'YYYY-Wxx'
export type MonthId = string; // 'YYYY-MM'
export type View = "overview" | "client" | "staff" | "staffDetail" | "reports" | "settings" | "archive";

export type WeeklyDoc = {
  weekId: WeekId;
  days: { mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean; sat: boolean; sun: boolean };
  status: DocStatus;
  note?: string;           // NEW
  lastUpdated?: string;
  deletedAt?: string;      // NEW - ISO datum när dokumentet mjuk-raderades
};

export type MonthlyReport = {
  monthId: MonthId;
  sent: boolean;
  status: DocStatus;
  note?: string;           // NEW
  lastUpdated?: string;
  deletedAt?: string;      // NEW - ISO datum när rapporten mjuk-raderades
};

export type VismaWeek = {
  weekId: WeekId;
  days: { mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean };
  status: DocStatus;
  lastUpdated?: string;
  deletedAt?: string;      // NEW - ISO datum när Visma-veckan mjuk-raderades
};

export type Plan = {
  carePlanDate?: string;
  hasGFP: boolean;
  staffNotified: boolean;
  notes: string;
  lastUpdated?: string;
  deletedAt?: string;      // NEW - ISO datum när planen mjuk-raderades
};

export type GFPPlan = {
  id: string;          // t.ex. crypto-random eller Date.now().toString()
  title: string;       // 'GFP 1', 'GFP 2', ...
  date: string;        // 'YYYY-MM-DD'
  dueDate: string;     // 'YYYY-MM-DD' (date + 21 dagar)
  note: string;
  staffInformed: boolean;
  done: boolean;       // motsvarar "GFP klar"
  status: DocStatus;   // frivilligt om ni vill visa pillers på planen
  deletedAt?: string;  // NEW - ISO datum när GFP-planen mjuk-raderades
};

export type Client = {
  id: string;
  name: string;
  plan: Plan;          // LEGACY - behålls för migration
  plans: GFPPlan[];    // NEW - flera vårdplaner
  weeklyDocs: Record<WeekId, WeeklyDoc>;
  monthlyReports: Record<MonthId, MonthlyReport>;
  visma: Record<WeekId, VismaWeek>;
  createdAt: string;
  archivedAt?: string; // NEW - ISO datum när klienten arkiverades
  deletedAt?: string;  // NEW - ISO datum när klienten mjuk-raderades
};

export type Staff = {
  id: string;
  name: string;
  clients: Client[];
  email?: string;
};

export type AppState = {
  staff: Staff[];
  selectedStaffId?: string;
  selectedClientId?: string;
  lastBackup?: string;
  version: string;
};

// Toast-relaterade typer för SaveBar
export type ToastType = 'success' | 'error' | 'info';

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
};

export type HistoryEntry = {
  id: string;
  periodType: 'week' | 'month';
  periodId: string; // WeekId eller MonthId
  staffId: string;
  clientId: string;
  metric: 'weekDoc' | 'monthReport' | 'gfp';
  status: DocStatus;
  value?: number; // För numeriska värden (t.ex. antal dagar)
  ts: string; // ISO timestamp när entry skapades/uppdaterades
};

// Tuesday Attendance Types
export type TuesdayAttendanceStatus =
  | 'unregistered'      // vit
  | 'excused_absence'   // blå
  | 'on_time'           // grön
  | 'late'              // orange
  | 'unexcused_absence'; // röd

export type TuesdayAttendance = {
  staffId: string;
  weekId: string;           // 'YYYY-Wxx'
  status: TuesdayAttendanceStatus;
  note?: string;            // fri text
  ts: string;               // ISO timestamp för senaste ändring
};

// API Response Types
export interface ApiResponse<T> {
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
  hasMore: boolean;
}

// Database User Type
export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: 'admin' | 'staff' | 'user';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Database Client Type
export interface DbClient {
  id: string;
  name: string;
  staff_id: string;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  deleted_at?: string;
}

// Database Care Plan Type
export interface DbCarePlan {
  id: string;
  client_id: string;
  care_plan_date?: string;
  has_gfp: boolean;
  staff_notified: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Database Weekly Doc Type
export interface DbWeeklyDoc {
  id: string;
  client_id: string;
  week_id: string;
  mon: boolean;
  tue: boolean;
  wed: boolean;
  thu: boolean;
  fri: boolean;
  sat: boolean;
  sun: boolean;
  status: DocStatus;
  note?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Database Monthly Report Type
export interface DbMonthlyReport {
  id: string;
  client_id: string;
  month_id: string;
  sent: boolean;
  status: DocStatus;
  note?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Database Visma Time Type
export interface DbVismaTime {
  id: string;
  client_id: string;
  week_id: string;
  mon: boolean;
  tue: boolean;
  wed: boolean;
  thu: boolean;
  fri: boolean;
  status: DocStatus;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Database GFP Plan Type
export interface DbGfpPlan {
  id: string;
  client_id: string;
  title: string;
  date: string;
  due_date: string;
  note: string;
  staff_informed: boolean;
  done: boolean;
  status: DocStatus;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// API Request/Response Types
export interface CreateClientBody {
  name: string;
  staffId: string;
}

export interface UpdateClientBody {
  name?: string;
  staffId?: string;
}

export interface CreateWeeklyDocBody {
  clientId: string;
  weekId: string;
  days: {
    mon: boolean;
    tue: boolean;
    wed: boolean;
    thu: boolean;
    fri: boolean;
    sat: boolean;
    sun: boolean;
  };
  status: DocStatus;
  note?: string;
}

export interface UpdateWeeklyDocBody {
  days?: {
    mon: boolean;
    tue: boolean;
    wed: boolean;
    thu: boolean;
    fri: boolean;
    sat: boolean;
    sun: boolean;
  };
  status?: DocStatus;
  note?: string;
}

export interface CreateMonthlyReportBody {
  clientId: string;
  monthId: string;
  sent: boolean;
  status: DocStatus;
  note?: string;
}

export interface UpdateMonthlyReportBody {
  sent?: boolean;
  status?: DocStatus;
  note?: string;
}

export interface CreateVismaTimeBody {
  clientId: string;
  weekId: string;
  days: {
    mon: boolean;
    tue: boolean;
    wed: boolean;
    thu: boolean;
    fri: boolean;
  };
  status: DocStatus;
}

export interface UpdateVismaTimeBody {
  days?: {
    mon: boolean;
    tue: boolean;
    wed: boolean;
    thu: boolean;
    fri: boolean;
  };
  status?: DocStatus;
}

export interface CreateGfpPlanBody {
  clientId: string;
  title: string;
  date: string;
  dueDate: string;
  note: string;
  staffInformed: boolean;
  done: boolean;
  status: DocStatus;
}

export interface UpdateGfpPlanBody {
  title?: string;
  date?: string;
  dueDate?: string;
  note?: string;
  staffInformed?: boolean;
  done?: boolean;
  status?: DocStatus;
}

// KPI Types
export interface KPIMetrics {
  totalClients: number;
  totalStaff: number;
  activeCarePlans: number;
  waitingCarePlans: number;
  delayedCarePlans: number;
  completedThisWeek: number;
  pendingThisWeek: number;
  completedThisMonth: number;
  pendingThisMonth: number;
  vismaCompleted: number;
  vismaPending: number;
}
