import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const addonRoot = resolve(__dirname, '..');
const stageDir = join(addonRoot, '.build', 'xpi-stage');
const releaseDir = join(addonRoot, 'release');

const manifest = JSON.parse(await import(`file://${join(addonRoot, 'manifest.json')}`, { with: { type: 'json' } }).then(m => JSON.stringify(m.default)));
const xpiName = `zotero-plus-bridge-${manifest.version}.xpi`;
const xpiPath = join(releaseDir, xpiName);

rmSync(stageDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });
mkdirSync(releaseDir, { recursive: true });

for (const name of ['manifest.json', 'bootstrap.js', 'content']) {
  cpSync(join(addonRoot, name), join(stageDir, name), { recursive: true });
}

if (existsSync(xpiPath)) {
  rmSync(xpiPath, { force: true });
}

execFileSync('zip', ['-q', '-r', xpiPath, 'manifest.json', 'bootstrap.js', 'content'], {
  cwd: stageDir,
  stdio: 'inherit'
});

console.log(xpiPath);
