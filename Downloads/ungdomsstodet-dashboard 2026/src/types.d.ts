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
export interface DbClient {
    id: string;
    name: string;
    staff_id: string;
    created_at: string;
    updated_at: string;
    archived_at?: string;
    deleted_at?: string;
}
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
