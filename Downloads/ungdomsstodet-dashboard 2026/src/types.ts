/**
 * Typdefinitioner för Ungdomsstöd Admin
 * Enligt projektregler: dessa typer får INTE brytas
 */

export type DocStatus = 'approved' | 'pending' | 'rejected';
export type WeekId = string; // 'YYYY-Wxx'
export type MonthId = string; // 'YYYY-MM'
export type View = "overview" | "client" | "staff" | "staffDetail" | "reports" | "settings";

export type WeeklyDoc = {
  weekId: WeekId;
  days: { mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean; sat: boolean; sun: boolean };
  status: DocStatus;
  lastUpdated?: string;
};

export type MonthlyReport = {
  monthId: MonthId;
  sent: boolean;
  status: DocStatus;
  lastUpdated?: string;
};

export type VismaWeek = {
  weekId: WeekId;
  days: { mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean };
  status: DocStatus;
  lastUpdated?: string;
};

export type Plan = {
  carePlanDate?: string;
  hasGFP: boolean;
  staffNotified: boolean;
  notes: string;
  lastUpdated?: string;
};

export type Client = {
  id: string;
  name: string;
  plan: Plan;
  weeklyDocs: Record<WeekId, WeeklyDoc>;
  monthlyReports: Record<MonthId, MonthlyReport>;
  visma: Record<WeekId, VismaWeek>;
  createdAt: string;
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
