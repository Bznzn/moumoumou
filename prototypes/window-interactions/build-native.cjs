const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = __dirname;
const build = path.join(root, 'build');
const cache = path.join(build, 'module-cache');
fs.mkdirSync(cache, { recursive: true });
const plist = (name, id, background) => `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${id}</string><key>CFBundleName</key><string>${name}</string><key>CFBundleExecutable</key><string>${name}</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>LSMinimumSystemVersion</key><string>13.0</string><key>LSUIElement</key><${background ? 'true' : 'false'}/></dict></plist>`;
for (const app of [
  { name: 'SalaryGestureProbe', files: ['GestureState.swift', 'GestureProbe.swift'], background: true },
  { name: 'SalaryProbeWorkpad', files: ['Workpad.swift'], background: false },
  { name: 'SalaryPresentationProbe', files: ['PresentationGeometry.swift', 'PresentationProbe.swift'], background: true },
]) {
  const contents = path.join(build, app.name + '.app', 'Contents');
  const executable = path.join(contents, 'MacOS', app.name);
  const sources = app.files.map(file => path.join(root, 'native', file));
  const hash = createHash('sha256').update(JSON.stringify(app));
  sources.forEach(file => hash.update(fs.readFileSync(file)));
  const fingerprint = hash.digest('hex');
  const stamp = path.join(build, app.name + '.source-hash');
  // Do not rebuild an unchanged, already-authorised ad-hoc helper: its
  // designated requirement contains its code hash, so recompiling can revoke TCC.
  const exists = fs.existsSync(executable);
  const unchanged = exists && (fs.existsSync(stamp)
    ? fs.readFileSync(stamp, 'utf8') === fingerprint
    : sources.every(file => fs.statSync(file).mtimeMs <= fs.statSync(executable).mtimeMs));
  if (unchanged) {
    execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', path.join(build, app.name + '.app')]);
    fs.writeFileSync(stamp, fingerprint);
    console.log('Unchanged, preserving identity: ' + app.name);
    continue;
  }
  fs.mkdirSync(path.join(contents, 'MacOS'), { recursive: true });
  execFileSync('xcrun', ['swiftc', '-module-cache-path', cache, ...app.files.map(file => path.join(root, 'native', file)), '-o', path.join(contents, 'MacOS', app.name)], { stdio: 'inherit' });
  fs.writeFileSync(path.join(contents, 'Info.plist'), plist(app.name, 'local.salary-float.' + app.name.toLowerCase(), app.background));
  execFileSync('/usr/bin/codesign', ['--force', '--sign', '-', '--identifier', 'local.salary-float.' + app.name.toLowerCase(), path.join(build, app.name + '.app')], { stdio: 'inherit' });
  fs.writeFileSync(stamp, fingerprint);
  console.log('Built ' + path.join(build, app.name + '.app'));
}
