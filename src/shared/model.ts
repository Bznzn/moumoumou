export type DateKey = string;
export type MonthKey = string;
export type WorkState = 'unconfigured' | 'before' | 'working' | 'lunch' | 'finished' | 'rest' | 'no-plan';
export type ScheduleRule = { kind: 'weekly'; weekdays: number[] } | { kind: 'alternating'; anchorMonday: DateKey; anchorType: 'big' | 'small' };
export interface WorkHours { start: string; end: string; lunch: { start: string; end: string } | null }
export interface SalaryVersion { from: MonthKey; salaryCents: number }
export interface ScheduleVersion { from: MonthKey; rule: ScheduleRule; hours: WorkHours }
export interface AppConfig {
  schemaVersion: 1; workTimeZone: string;
  salaries: SalaryVersion[]; schedules: ScheduleVersion[];
  dateOverrides: Record<DateKey, boolean>;
  appearance: { hoverOpacity: number; fullScreenOpacity: number; fullScreenHoverOpacity: number; milestoneYuan: 0 | 10 | 100 };
  launchAtLogin: boolean;
  nativeInteraction?: boolean;
  window: { displayId: number | null; x: number; y: number; hidden: boolean; scale?:number };
}
export interface DayIncome { date: DateKey; plannedSeconds: number; elapsedSeconds: number; earnedCents: number; isWorkday: boolean }
export interface MonthIncome { month: MonthKey; salaryCents: number | null; plannedSeconds: number; earnedCents: number; rateCentsPerSecond: number; days: DayIncome[]; isFuture: boolean }
export interface IncomeSnapshot { state: WorkState; date: DateKey; today: DayIncome; month: MonthIncome; nextWorkAt: number | null }
export type Validation = { ok: true; value: AppConfig } | { ok: false; issues: { path: string; message: string }[] };
