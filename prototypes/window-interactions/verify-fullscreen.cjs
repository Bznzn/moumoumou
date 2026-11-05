const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const path = require('node:path');
const fs = require('node:fs');
const processes = [];
const transitions = [];
let finished = false;
let sawFull = false;
let workpad;
let workpadReady = false;
function finish(ok, reason) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  for (const child of processes) child.kill('SIGTERM');
  fs.mkdirSync(path.join(__dirname, 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'evidence/fullscreen-check.json'), JSON.stringify({ ok, reason, transitions }, null, 2));
  console.log((ok ? 'PASS: ' : 'FAIL: ') + reason);
  process.exitCode = ok ? 0 : 1;
}
function launch(name, args, onEvent) {
  const child = spawn(path.join(__dirname, 'build', name + '.app', 'Contents/MacOS', name), args, { stdio: ['ignore', 'pipe', 'pipe'] });
  processes.push(child);
  createInterface({ input: child.stdout }).on('line', line => { try { onEvent(JSON.parse(line)); } catch { /* ignore native informational output */ } });
  child.stderr.on('data', data => process.stderr.write(data));
  child.on('error', error => finish(false, error.message));
  return child;
}
const timeout = setTimeout(() => finish(false, 'did not observe another app enter and exit native full-screen'), 15000);
launch('SalaryPresentationProbe', [], event => {
  if (event.type !== 'fullscreen') return;
  transitions.push(event.value);
  console.log('Presentation: ' + JSON.stringify(event));
  if (!workpad) workpad = launch('SalaryProbeWorkpad', ['--verify-presentation'], value => { console.log('Workpad: ' + JSON.stringify(value)); if (value.type === 'workpad-ready') workpadReady = true; });
  if (!workpadReady) return;
  if (event.value) sawFull = true;
  else if (sawFull) finish(true, 'public AppKit monitor observed another process enter and exit native full-screen');
});
