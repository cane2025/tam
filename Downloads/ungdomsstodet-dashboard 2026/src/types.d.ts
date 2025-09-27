/**
 * Typdefinitioner för Ungdomsstöd Admin
 * Enligt projektregler: dessa typer får INTE brytas
 */
export type DocStatus = 'approved' | 'pending' | 'rejected';
export type WeekId = string;
export type MonthId = string;
export type View = "overview" | "client" | "staff" | "staffDetail" | "reports" | "settings" | "archive";
export type WeeklyDoc = {
    weekId: WeekId;
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
    lastUpdated?: string;
    deletedAt?: string;
};
export type MonthlyReport = {
    monthId: MonthId;
    sent: boolean;
    status: DocStatus;
    note?: string;
    lastUpdated?: string;
    deletedAt?: string;
};
export type VismaWeek = {
    weekId: WeekId;
    days: {
        mon: boolean;
        tue: boolean;
        wed: boolean;
        thu: boolean;
        fri: boolean;
    };
    status: DocStatus;
    lastUpdated?: string;
    deletedAt?: string;
};
export type Plan = {
    carePlanDate?: string;
    hasGFP: boolean;
    staffNotified: boolean;
    notes: string;
    lastUpdated?: string;
    deletedAt?: string;
};
export type GFPPlan = {
    id: string;
    title: string;
    date: string;
    dueDate: string;
    note: string;
    staffInformed: boolean;
    done: boolean;
    status: DocStatus;
    deletedAt?: string;
};
export type Client = {
    id: string;
    name: string;
    plan: Plan;
    plans: GFPPlan[];
    weeklyDocs: Record<WeekId, WeeklyDoc>;
    monthlyReports: Record<MonthId, MonthlyReport>;
    visma: Record<WeekId, VismaWeek>;
    createdAt: string;
    archivedAt?: string;
    deletedAt?: string;
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
    periodId: string;
    staffId: string;
    clientId: string;
    metric: 'weekDoc' | 'monthReport' | 'gfp';
    status: DocStatus;
    value?: number;
    ts: string;
};
export type TuesdayAttendanceStatus = 'unregistered' | 'excused_absence' | 'on_time' | 'late' | 'unexcused_absence';
export type TuesdayAttendance = {
    staffId: string;
    weekId: string;
    status: TuesdayAttendanceStatus;
    note?: string;
    ts: string;
};
