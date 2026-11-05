# Salary Float Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建按月薪与计划作息实时显示收入的 macOS Electron 应用，具备大小周、收入历史和用户选定的精品悬浮窗交互。

**Architecture:** 先用隔离的最小 Electron/macOS 原型验证系统事件路由，通过后再实现产品。主进程拥有窗口、存储与系统集成；共享纯函数负责排班和金额；React 负责设置、收入概览和悬浮窗。原生辅助模块仅在公开接口验证有效时加入。

**Tech Stack:** Electron、TypeScript、React、Vite、Vitest、Playwright（Electron 集成）、electron-builder；macOS 原生辅助按验证结果决定。

**Spec:** `docs/superpowers/specs/2026-11-04-salary-float-design.md`（已批准）。执行者须先读该设计。

## Global Constraints

- 目标实机：Apple Silicon arm64、macOS 13.7.8；当前 Node v24.22.1、npm 12.2.1、Swift 命令行工具可用。依赖安装前核实版本兼容，锁定到 lockfile；Electron 运行时不得要求更高系统版本。
- 单击穿透至后方窗口；可直接拖动，用户明确希望使用 macOS 三指拖动；不设置额外的解锁按钮。
- 仅使用公开、可维护的接口。原型不通过则停止产品实现，记录证据并回到用户确认；网页内模拟穿透不算通过。
- 每秒收入由当月计划总秒数折算；金额从墙上时钟重算，不增量累加舍入值。
- 大小周大周周一至周六、小周周一至周五；周日起休，以周一为周起点连续轮换，日期覆盖优先。
- 今日金额两位小数，每秒收入四位；月总额由未舍入结果计算。
- 窗口约 300 × 182 逻辑像素；深色精品外观；数位滚动与每 ¥100 微光默认开启，可选 ¥10 / ¥100 / 关闭。
- 普通/悬停/全屏/全屏悬停/拖动不透明度分别为 1 / 0.28 / 0.45 / 0.20 / 1；过渡 180–220ms。
- 登录后自动显示菜单栏及悬浮窗；仅首次无配置时弹设置，辅助窗口正常交互。
- 全部数据本机保存；月薪和常规排班按月生效，默认下月；不追溯修改更早月份。
- 不初始化 Git、不创建新 worktree；当前目录没有 Git 仓库。各任务检查点不擅自创建提交；若用户后续初始化 Git 再提交。
- 用户已选择当前会话逐项执行；可以安装依赖和运行原型，仍须遵守 Task 1 门槛。

## Review Focus

1. 日历日期与时区：启动在别的系统时区时，已保存的工作时区、大小周和历史不得漂移；Task 2 固定测试。
2. 生效月份与手动覆盖：调薪、改班只改相关月份，切换基础排班不丢手动日期；Task 3 固定测试。
3. 系统事件组合：在别的应用上穿透点击与三指拖动并存，不能重复单击、误拖后方窗口；Task 1 与 Task 7 实机矩阵。
4. 生命周期中断：休眠唤醒、登录启动、时钟跳变、显示器拔除后数字和窗口状态正确；Task 4/5/7 固定测试。
5. 数据和显示边界：损坏配置、零工作日、巨额输入、金额进位、减少动态效果不造成数据丢失或 UI 溢出；Task 2/3/6 固定测试。

## 文件职责与接口约定

```text
prototypes/window-interactions/  隔离的原生可行性实验，禁止当作正式应用
docs/verification/              实机矩阵、版本及复现记录
src/shared/model.ts            共享数据与 IPC 数据类型
src/shared/calendar.ts         日期、工作时区、循环排班、有效时间区间
src/shared/income.ts           今日、月份、历史与状态的纯计算
src/shared/config.ts           配置校验、按月修改及影响预览
src/main/storage.ts            原子存储、备份、损坏恢复
src/main/platform.ts           唯一 macOS 适配入口，复用原型验证过的方法
src/main/window-policy.ts      穿透、拖动、全屏、悬停状态优先级
src/main/windows.ts            悬浮窗与普通辅助窗口创建/生命周期
src/main/tray.ts               菜单栏入口
src/main/ipc.ts                严格类型及来源验证的 IPC
src/main/index.ts              启动、登录设置、退出与单实例
src/preload/index.ts           contextBridge 限定能力
src/renderer/                  React 页面及精品样式
tests/                         纯函数、主进程契约、UI 与 Electron 集成
package.json / package-lock.json / tsconfig*.json / vite.config.ts
electron-builder.yml / README.md / .gitignore
```

Task 2 定义下列共享契约，后续任务不得另起同义类型：

```ts
type DateKey = string; // 严格 YYYY-MM-DD，按工作时区解释
type MonthKey = string; // 严格 YYYY-MM
type WorkState = 'unconfigured' | 'before' | 'working' | 'lunch' | 'finished' | 'rest' | 'no-plan';
type ScheduleRule =
  | { kind: 'weekly'; weekdays: number[] }
  | { kind: 'alternating'; anchorMonday: DateKey; anchorType: 'big' | 'small' };
interface WorkHours { start: string; end: string; lunch: { start: string; end: string } | null }
interface SalaryVersion { from: MonthKey; salaryCents: number }
interface ScheduleVersion { from: MonthKey; rule: ScheduleRule; hours: WorkHours }
interface AppConfig {
  schemaVersion: 1; workTimeZone: string;
  salaries: SalaryVersion[]; schedules: ScheduleVersion[];
  dateOverrides: Record<DateKey, boolean>;
  appearance: { hoverOpacity: number; fullScreenOpacity: number; fullScreenHoverOpacity: number; milestoneYuan: 0 | 10 | 100 };
  launchAtLogin: boolean;
  window: { displayId: number | null; x: number; y: number; hidden: boolean };
}
interface DayIncome { date: DateKey; plannedSeconds: number; elapsedSeconds: number; earnedCents: number; isWorkday: boolean }
interface MonthIncome { month: MonthKey; salaryCents: number | null; plannedSeconds: number; earnedCents: number; rateCentsPerSecond: number; days: DayIncome[]; isFuture: boolean }
interface IncomeSnapshot { state: WorkState; date: DateKey; today: DayIncome; month: MonthIncome; nextWorkAt: number | null }
type Validation = { ok: true; value: AppConfig } | { ok: false; issues: { path: string; message: string }[] };
```

`earnedCents` 保留未舍入浮点结果，仅 UI 格式化到两位元；月薪输入换算为整数分。设计首版选择可靠的 IANA 时区库（实施时核实兼容版本），使用真实时区日界与 DST 行为，不用固定 UTC 偏移模拟时区。

---

### Task 1: 先验证真实 macOS 的窗口/手势组合

**Files:** Create `prototypes/window-interactions/{package.json,main.cjs,preload.cjs,panel.html}`、`prototypes/window-interactions/native/`（仅必要时）、`docs/verification/native-interactions.md`、`.gitignore`。

**Interfaces:** Consumes: 实机 macOS、设计中的交互约束。Produces: 通过/失败矩阵、公开接口选择，以及可供 Task 4 实现的 `PlatformAdapter` 行为依据；不输出未经验证的接口承诺。

- [ ] 检查官方 Electron/macOS 支持信息，选择支持 macOS 13.7.8 的版本；在隔离目录安装并锁定原型依赖，`.gitignore` 排除依赖、构建和证据临时文件。
- [ ] 建立同一个悬浮窗的三个对照模式：`ignoreMouseEvents(true,{forward:true})`、可交互拖动区、候选组合。不要先绘制正式 UI。
- [ ] 执行 `npm --prefix prototypes/window-interactions start`；使用真正的后方应用测试点击/双击/选中/滚动/焦点；记录组合模式的单击是否只到达后方一次。
- [ ] 在系统启用三指拖动的条件下验证直接拖动；记录普通鼠标拖动对照。原型可提示用户开启系统手势，不自动更改其系统设置。
- [ ] 验证普通窗口、另一个应用的原生全屏 Space、悬停透明度、退出全屏、休眠恢复、显示器切换；所有事件不得通过网页计数器冒充。
- [ ] 若纯 Electron 失败，仅调查公开 macOS API 的最小辅助实现；记录依赖、所需系统授权和限制，再重复同一矩阵。没有可靠候选则标记门槛未通过，停止后续任务，向用户报告证据和替代交互。
- [ ] 检查点：`native-interactions.md` 包含 OS/硬件/Electron 版本、每项实测结果、复现步骤、未覆盖项。只有五项设计门槛均通过才进入 Task 2；缺少外接显示器等条件时明确记录并补验，不能写成全覆盖。

### Task 2: 排班、时区与收入计算内核

**Files:** Create 根目录 `package.json`、锁文件、TypeScript/Vitest 配置；`src/shared/{model,calendar,income}.ts`；`tests/shared/{calendar,income}.test.ts`。

**Interfaces:** Consumes: 设计计算规则。Produces:
- `isWorkday(date: DateKey, config: AppConfig): boolean`
- `plannedIntervals(date: DateKey, config: AppConfig): Array<{start: number; end: number}>`，毫秒 epoch，排除午休。
- `calculateMonth(config: AppConfig, month: MonthKey, nowMs: number): MonthIncome`
- `calculateSnapshot(config: AppConfig, nowMs: number): IncomeSnapshot`

- [ ] 先写失败测试：参考周 `2026-11-02` 为大周，11/7、11/21 工作，11/14、11/28 休息；12/5、12/19 工作；参考周以前的 10/31 按负周偏移为小周休息。覆盖跨年与周日。
- [ ] 加入精确计算断言：月薪 1,200,000 分，大小周、09–18/午休12–13、工作时区 Asia/Shanghai；11 月 23 天、662,400 秒；11/4 15:00 今日为 `1200000*5/184` 分，本月为 `1200000*21/184` 分，月末总额 `1200000` 分。
- [ ] 加入午休12:00/13:00、下班18:00、休息日、关闭午休、月初、无月薪月份、零工作日、未来月份和整月舍入测试；系统 TZ 不同但工作时区相同应输出相同日期/金额。对 DST 时区边界至少一个测试。
- [ ] 运行 `npm test -- tests/shared/calendar.test.ts tests/shared/income.test.ts`，确认因缺少实现失败；然后定义上述模型并实现计算，下一工作日搜索最多 366 天，未找到返回 null。
- [ ] 重跑同一测试命令并执行 `npm run typecheck`，全部通过。检查金额始终来自传入 `nowMs`，无计时器累计、无隐藏的当前时间依赖。

### Task 3: 配置版本、影响预览与可恢复存储

**Files:** Create `src/shared/config.ts`、`src/main/storage.ts`、`tests/shared/config.test.ts`、`tests/main/storage.test.ts`。

**Interfaces:** Consumes: Task 2 模型与计算函数。Produces:
- `validateConfig(input: unknown): Validation`
- `applyMonthlyChange(config: AppConfig, change: {from: MonthKey; salaryCents?: number; schedule?: {rule: ScheduleRule; hours: WorkHours}}): AppConfig`
- `setDateOverride(config: AppConfig, date: DateKey, value: boolean | null): AppConfig`
- `previewChange(before: AppConfig, after: AppConfig, nowMs: number): {affectedMonths: MonthKey[]; before: IncomeSnapshot; after: IncomeSnapshot}`
- `createConfigStore(directory: string): {load(): Promise<{config: AppConfig | null; recovered: boolean; error: string | null}>; save(config: AppConfig): Promise<void>}`

- [ ] 先写失败测试：从12月改薪不改11月；从11月改薪不改10月；同月版本替换不重复；日期覆盖保持且不移动大小周锚点；覆盖改动使所在月总工时及历史按设计重算。
- [ ] 校验测试覆盖非法日期、重复版本、无效时区、跨夜作息、午休越界、无穷与负数月薪、月薪分数非整数、安全整数上限、透明度越界；无有效计划工时允许保存但必须显示 `no-plan`，不产生 NaN。
- [ ] 写临时目录存储测试：首次无文件、原子保存、并发保存串行、主文件损坏而备份有效、两份均损坏、未知 schema 不静默覆盖。运行 `npm test -- tests/shared/config.test.ts tests/main/storage.test.ts` 确认失败。
- [ ] 实现月版本选择与纯变更函数；写入前验证，序列化临时文件后 rename，保留最后有效备份。恢复错误由返回值交给 UI，禁止静默新建空配置覆盖原数据。
- [ ] 重跑上述测试并 `npm run typecheck`。检查点：收入变更预览展示受影响月份，工作时区仅在首次设置从系统读取并持久化。

### Task 4: 系统适配和悬浮窗状态机

**Files:** Create `src/main/{platform,window-policy,windows}.ts`、必要的 `native/`、`tests/main/window-policy.test.ts`、`tests/main/window-placement.test.ts`。

**Interfaces:** Consumes: Task 1 验证方法、`AppConfig`。Produces:
- `type OverlaySignals = {hovered: boolean; dragging: boolean; otherAppFullscreen: boolean; userHidden: boolean}`
- `resolveOverlay(config: AppConfig, signals: OverlaySignals): {opacity: number; visible: boolean}`
- `PlatformAdapter`：`start(panel: BrowserWindow, onSignals: (signals: Partial<OverlaySignals>) => void): Promise<void>`、`stop(): void`；平台内部实现真实穿透与直接手势路由，不由 renderer 设置任意鼠标模式。
- `createWindows(options: {getConfig: () => AppConfig | null; platform: PlatformAdapter}): {showOverlay(): void; hideOverlay(): void; openSettings(): void; openOverview(): void; destroy(): void}`
- `restorePlacement(saved: AppConfig['window'], displays: Array<{id: number; workArea: {x: number; y: number; width: number; height: number}}>): {x: number; y: number}`

- [ ] 写状态优先级失败测试：普通1、悬停.28、全屏.45、全屏悬停.20、任意拖动1；隐藏优先于所有状态。输入不应改变辅助窗口的事件规则。
- [ ] 写显示器断开、负坐标、缩放工作区域、旧位置不可见时回到当前可用屏幕的测试。运行 `npm test -- tests/main/window-policy.test.ts tests/main/window-placement.test.ts` 确认失败。
- [ ] 实现状态与位置恢复；用 Task 1 实测方式接入 `PlatformAdapter`。检测的是**其他应用**的全屏空间，不能仅监听本应用 `enter-full-screen` 冒充。`createWindows` 将悬浮窗与普通设置/概览窗口完全分离。
- [ ] 重跑测试；实机重跑 Task 1 矩阵，记录正式窗口上的结果。悬停不抢焦点，移动结束/唤醒/屏幕更改时重新同步状态并保存有效位置。

### Task 5: 主进程、菜单栏、登录启动及安全 IPC

**Files:** Create `src/main/{index,tray,ipc}.ts`、`src/preload/index.ts`、`src/shared/api.ts`、`tests/main/{ipc,lifecycle}.test.ts`；构建配置与开发入口。

**Interfaces:** Consumes: Task 2–4。Produces `SalaryFloatApi`：
```ts
interface SalaryFloatApi {
  getConfig(): Promise<AppConfig | null>;
  getStorageStatus(): Promise<{recovered: boolean; error: string | null}>;
  getSnapshot(): Promise<IncomeSnapshot | null>;
  getMonth(month: MonthKey): Promise<MonthIncome | null>;
  previewConfig(candidate: unknown): Promise<{validation: Validation; impact: ReturnType<typeof previewChange> | null}>;
  saveConfig(candidate: unknown): Promise<Validation>;
  openWindow(kind: 'settings' | 'overview'): Promise<void>;
  onSnapshot(listener: (snapshot: IncomeSnapshot) => void): () => void;
  onConfig(listener: (config: AppConfig) => void): () => void;
}
```
`previewChange` 从 shared/config 引入，数据契约定义于 shared/api；首次无配置时 `previewConfig` 的 impact 为 null。存储恢复状态通过 `getStorageStatus` 提供给首次设置或设置窗口，不把恢复提示丢在日志里。preload 不导出 Node、文件路径或通用 invoke。

- [ ] 失败测试覆盖非法/外部 sender、错误路由和类型、任意路径输入、重复窗口/订阅清理；生命周期测试覆盖无配置初启、已配置登录、隐藏与退出区别、第二实例、恢复备份的可见提示。
- [ ] 运行 `npm test -- tests/main/ipc.test.ts tests/main/lifecycle.test.ts` 确认失败；实现受控 IPC 和菜单栏，禁用 Node integration、启用 context isolation，校验发送窗口身份及载荷，拦截外部导航。
- [ ] 实现单实例启动、默认登录启动、首次设置完成后不再弹设置；登录启动使用打包应用路径，开发模式不注册失效的运行路径。
- [ ] 推送快照以约250ms定时计算刷新，监听唤醒并立即重算；主进程以真实时钟为准。关闭设置不退出；菜单「退出」清理平台监听与订阅。
- [ ] 重跑测试；使用注入时钟证明休眠一小时/墙上时钟跳变后与 `calculateSnapshot` 一致，不补发微光；`npm run dev` 可启动主进程、preload 和 renderer。

### Task 6: React 设置、排班日历、悬浮窗与概览

**Files:** Create `src/renderer/{index.html,main.tsx,App.tsx,styles.css,api.ts}`、`src/renderer/{overlay,settings,overview}/`、`tests/renderer/{settings,calendar,overlay,overview}.test.tsx`。

**Interfaces:** Consumes: `window.salaryFloat: SalaryFloatApi`、Task 2 模型。Produces 三个页面：`OverlayPage()`、`SettingsPage()`、`OverviewPage()`；动画契约 `shouldCelebrate(previous: IncomeSnapshot | null, next: IncomeSnapshot, thresholdYuan: 0 | 10 | 100, reason: 'tick' | 'refresh'): boolean`。

- [ ] 写行为失败测试：设置切换固定/大小周、参考周、关闭午休、点击日期覆盖及清除、实时每秒速率、月薪生效选择、保存前影响预览；本月变更明确提示重算历史。
- [ ] 写展示测试：午休暂停/下班保留/休息日/零工时，月累计不相加已舍入日值；月份无配置不编造金额、未来月标计划；恢复错误可见而非清空。
- [ ] 写动画失败测试：只有 `working` 的实时tick跨阈值才微光；刷新/重启/回退/重算不触发；减少动态效果关闭滚动与扫光；999→1000、最大有效月薪和较大字体下主金额不溢出。
- [ ] 运行 `npm test -- tests/renderer` 确认失败；实现一屏设置、可配置月份和日历，以及菜单栏打开的收入概览。沿用已批准效果中的石墨与香槟色，不添加新主题或仪表盘。
- [ ] 悬浮窗以单独数位实现轻上滚，变化中取消/收束上次动画避免堆积；CSS响应 reduced-motion。概览日明细展示完整每秒值计算依据；格式化函数统一到元两位/每秒四位。
- [ ] 重跑测试、`npm run typecheck`、`npm run build`。在真实Electron检查键盘焦点、设置可操作、窄布局、中文与金额位数；不可把DOM `click`转发当成正式系统穿透实现。

### Task 7: 集成、arm64 安装包与实机验收

**Files:** Create `tests/e2e/app.spec.ts`、`electron-builder.yml`、应用图标资源、`README.md`；更新 `docs/verification/native-interactions.md`，Create `docs/verification/release-checklist.md`。

**Interfaces:** Consumes: Task 1–6；Produces 本机可运行的 `.app` 与 arm64 `.dmg`、安装/配置说明和真实验收记录。

- [ ] 写Electron集成失败测试：通过隔离用户数据目录 `SALARY_FLOAT_USER_DATA` 启动打包产物，首次完成设置→悬浮窗→概览→保存下月调薪→退出重开，确认配置和收入正确；测试目录必须位于临时路径，不触碰真实用户数据。
- [ ] 运行 `npm run test:e2e` 确认尚缺打包流程时失败；配置 renderer 本地资源、preload、CSP和打包路径，封装已验证的原生依赖（若有），构建支持目标系统的 arm64 安装包。
- [ ] 运行 `npm test`、`npm run typecheck`、`npm run build`、`npm run dist:mac`、`npm run test:e2e`；各命令退出0，产物路径记录在release checklist。
- [ ] 在安装后的应用上验证：登录自动出现且不弹设置；真实后方应用单击穿透；系统三指拖动；普通/全屏及悬停透明度；下班保留；休眠重算；工作时区保留；显示器移除回收窗口。未实测项目明确列为待验，不宣称通过。
- [ ] README写明按计划估算、大小周参考周、手动调整导致本月重算、调薪生效、菜单栏入口、系统三指拖动设置及本机安装方式。不声明已公证、跨Mac分发、自动更新或第三方签名。
- [ ] 做一次整体验收审阅，修复可复现问题并重跑受影响检查。交付构建产物绝对路径、已通过检查及尚存限制，不用网页预览代替应用。

## 自审结果

- 设计覆盖：Task 1负责原生门槛；2负责时区/大小周/作息与金额；3负责版本/覆盖/恢复；4负责状态及位置；5负责启动/菜单栏/IPC；6负责全部产品界面与动画；7负责安装和实机验收。
- 类型一致：共享模型集中在model，API集中在api；跨任务均引用原定义，主进程不信任renderer的任意配置。
- Review Focus五项分别有具体单元/集成测试或真实系统矩阵；不以mock测试替代系统手势证据。
- 无现有仓库，不把创建分支/提交作为执行前置要求；依赖和产品代码均尚未创建。

## 执行方式已确认

- **Native（建议）**：当前会话逐项执行，保持计算、IPC与窗口适配接口连贯；最后独立整体审阅。首先运行原生门槛，失败时不继续堆叠产品代码。
- **Subagent-driven**：每项由新子代理执行，并独立审阅后进入下一项，隔离性更强、上下文与审阅成本更高。

用户选择 Native，由当前会话逐项执行。按 executing-plans 技能执行，不报告尚未实现的能力已完成。
