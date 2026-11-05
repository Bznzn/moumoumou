import type { AppConfig } from '../src/shared/model';
export const now = Date.parse('2026-11-04T15:00:00+08:00');
export function fixture(): AppConfig {
  return {
    schemaVersion: 1, workTimeZone: 'Asia/Shanghai',
    salaries: [{ from: '2026-10', salaryCents: 1200000 }],
    schedules: [{ from: '2026-10', rule: { kind: 'alternating', anchorMonday: '2026-11-02', anchorType: 'big' }, hours: { start: '09:00', end: '18:00', lunch: { start: '12:00', end: '13:00' } } }],
    dateOverrides: {}, appearance: { hoverOpacity: .28, fullScreenOpacity: .45, fullScreenHoverOpacity: .2, milestoneYuan: 100 },
    launchAtLogin: true, window: { displayId: null, x: 100, y: 100, hidden: false },
  };
}
