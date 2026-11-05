const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const root = __dirname;
const evidence = path.join(root, 'evidence');
fs.mkdirSync(evidence, { recursive: true });
const logPath = path.join(evidence, 'probe-' + Date.now() + '.jsonl');
let control, overlay, tray, helper, workpad, presentation;
let mode = 'through';
let nativeReady = false;
let hovered = false;
let dragging = false;
let fullPreview = false;
let detectedFullscreen = false;
const events = [];
function record(type, detail = {}) {
  const event = { at: new Date().toISOString(), type, ...detail };
  fs.appendFileSync(logPath, JSON.stringify(event) + '\n');
  events.push(event);
  if (events.length > 100) events.shift();
  notify();
}
function state() { return { mode, nativeReady, hovered, dragging, fullPreview, bounds: overlay?.getBounds(), logPath, events: events.slice(-12) }; }
function notify() { if (control && !control.isDestroyed()) control.webContents.send('probe:state', state()); }
function opacity() {
  if (!overlay || overlay.isDestroyed()) return;
  const full = detectedFullscreen || fullPreview;
  overlay.setOpacity(dragging ? 1 : hovered ? (full ? 0.20 : 0.28) : full ? 0.45 : 1);
}
function syncBounds() {
  if (helper?.stdin.writable && nativeReady) helper.stdin.write(JSON.stringify({ ...overlay.getBounds(), enabled: mode === 'combined' }) + '\n');
}
function stopHelper() {
  nativeReady = false;
  if (helper) { const old = helper; helper = null; old.stdin.end(); old.kill('SIGTERM'); }
  dragging = false;
  opacity();
}
function setMode(next) {
  stopHelper();
  mode = next;
  overlay.setIgnoreMouseEvents(next !== 'drag', { forward: true });
  overlay.webContents.send('probe:mode', next);
  record('mode', { mode });
  if (next !== 'combined') return;
  const executable = path.join(root, 'build/SalaryGestureProbe.app/Contents/MacOS/SalaryGestureProbe');
  if (!fs.existsSync(executable)) { mode = 'blocked'; record('native-unavailable', { reason: 'run npm run build:native first' }); return; }
  const child = spawn(executable, [], { stdio: ['pipe', 'pipe', 'pipe'] });
  helper = child;
  readline.createInterface({ input: child.stdout }).on('line', line => {
    if (helper !== child) return;
    let event;
    try { event = JSON.parse(line); } catch { return; }
    if (event.type === 'ready') { nativeReady = true; syncBounds(); record('native-ready', event); }
    else if (event.type === 'hover') { hovered = event.value === true; opacity(); notify(); }
    else if (event.type === 'dragging') { dragging = event.value === true; opacity(); record('native-dragging', { value: dragging }); }
    else if (event.type === 'move' && Number.isFinite(event.x) && Number.isFinite(event.y)) {
      const nearest = screen.getDisplayNearestPoint({ x: Math.round(event.x), y: Math.round(event.y) });
      const area = nearest.workArea;
      overlay.setPosition(Math.round(Math.max(area.x, Math.min(event.x, area.x + area.width - 300))), Math.round(Math.max(area.y, Math.min(event.y, area.y + area.height - 182))));
      syncBounds();
    } else if (event.type === 'unavailable' || event.type === 'disabled') {
      mode = 'blocked'; nativeReady = false; dragging = false;
      overlay.webContents.send('probe:mode', 'blocked');
      opacity(); record('native-unavailable', event);
    } else record('native', event);
  });
  child.stderr.on('data', data => record('native-stderr', { message: data.toString().slice(0, 1000) }));
  child.on('error', error => { if (helper === child) { mode = 'blocked'; nativeReady = false; record('native-error', { message: error.message }); } });
  child.on('exit', code => {
    if (helper !== child) return;
    helper = null; nativeReady = false; dragging = false;
    if (mode === 'combined') mode = 'blocked';
    opacity(); record('native-exit', { code });
  });
}
function openWorkpad() {
  if (workpad && !workpad.killed) return;
  const executable = path.join(root, 'build/SalaryProbeWorkpad.app/Contents/MacOS/SalaryProbeWorkpad');
  if (!fs.existsSync(executable)) { record('workpad-error', { message: 'run npm run build:native first' }); return; }
  workpad = spawn(executable, [], { stdio: ['ignore', 'pipe', 'pipe'] });
  const child = workpad;
  readline.createInterface({ input: child.stdout }).on('line', line => {
    try { record('workpad', JSON.parse(line)); } catch { /* ignore other native output */ }
  });
  child.stderr.on('data', data => record('workpad-stderr', { message: data.toString().slice(0, 1000) }));
  child.on('error', error => record('workpad-error', { message: error.message }));
  child.on('exit', code => { if (workpad === child) workpad = null; record('workpad-exit', { code }); });
}
app.setPath('userData', path.join(evidence, 'electron-user-data'));
app.whenReady().then(async () => {
  const area = screen.getPrimaryDisplay().workArea;
  record('environment', { electron: process.versions.electron, arch: process.arch, displays: screen.getAllDisplays().map(display => ({ id: display.id, bounds: display.bounds })) });
  control = new BrowserWindow({ width: 470, height: 650, x: Math.max(area.x, area.x + 30), y: area.y + 40, title: 'Salary Float — 交互可行性验证', webPreferences: { preload: path.join(root, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  overlay = new BrowserWindow({ width: 300, height: 182, x: Math.round(area.x + area.width / 2 - 20), y: Math.round(area.y + area.height / 2 - 150), frame: false, transparent: true, resizable: false, hasShadow: false, show: false, focusable: false, skipTaskbar: true, webPreferences: { preload: path.join(root, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  overlay.setAlwaysOnTop(true, 'floating');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.setIgnoreMouseEvents(true, { forward: true });
  const guard = window => {
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
  };
  guard(control); guard(overlay);
  overlay.on('move', () => { syncBounds(); notify(); });
  control.on('closed', () => app.quit());
  const authorised = (event, window) => event.sender === window?.webContents;
  ipcMain.handle('probe:state', event => { if (!authorised(event, control)) throw Error('untrusted sender'); return state(); });
  ipcMain.handle('probe:action', (event, action) => {
    if (!authorised(event, control)) throw Error('untrusted sender');
    if (['through','drag','combined'].includes(action)) setMode(action);
    else if (action === 'workpad') openWorkpad();
    else if (action === 'opacity') { fullPreview = !fullPreview; opacity(); record('opacity-preview', { fullPreview, actualOtherAppFullscreenDetected: false }); }
    else if (action === 'quit') app.quit();
    else throw Error('unknown action');
    return state();
  });
  await Promise.all([control.loadFile(path.join(root, 'control.html')), overlay.loadFile(path.join(root, 'panel.html'))]);
  overlay.showInactive();
  const presentationExecutable = path.join(root, 'build/SalaryPresentationProbe.app/Contents/MacOS/SalaryPresentationProbe');
  if (fs.existsSync(presentationExecutable)) {
    presentation = spawn(presentationExecutable, [], { stdio: ['ignore', 'pipe', 'pipe'] });
    readline.createInterface({ input: presentation.stdout }).on('line', line => {
      try { const event = JSON.parse(line); if (event.type === 'fullscreen') { detectedFullscreen = event.value === true; opacity(); record('fullscreen-detected', event); } } catch { /* not a protocol event */ }
    });
    presentation.on('error', error => record('presentation-error', { message: error.message }));
    presentation.stderr.on('data', data => record('presentation-stderr', { message: data.toString().slice(0,1000) }));
  }
  setMode('through');
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jk1QAAAAASUVORK5CYII=');
  tray = new Tray(icon); tray.setTitle('薪·测试');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: '显示测试控制台', click: () => control.show() }, { label: '退出原型', click: () => app.quit() }]));
  setInterval(() => {
    if (!overlay || overlay.isDestroyed() || dragging || nativeReady) return;
    const p = screen.getCursorScreenPoint(), b = overlay.getBounds();
    const inside = p.x >= b.x && p.x < b.x+b.width && p.y >= b.y && p.y < b.y+b.height;
    if (inside !== hovered) { hovered = inside; opacity(); notify(); }
  }, 60).unref();
  record('probe-ready', { productImplementation: false });
});
app.on('before-quit', () => { stopHelper(); workpad?.kill('SIGTERM'); presentation?.kill('SIGTERM'); });
app.on('window-all-closed', () => app.quit());
