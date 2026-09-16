#!/usr/bin/env node
// Release helper: bumps version in package.json + src-tauri/Cargo.toml
// (+ lockfiles), commits and creates an annotated git tag `vX.Y.Z`.
//
// Usage:
//   node scripts/release.mjs patch|minor|major [--dry-run]
//   npm run release:patch | npm run release:minor | npm run release:major
//
// The CI workflow (.github/workflows/ci.yml) builds installers and drafts
// a GitHub Release automatically when a tag is pushed:
//   git push --follow-tags

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const KIND = process.argv.find((a) => ['major', 'minor', 'patch'].includes(a)) ?? 'patch'

function sh(cmd, args, opts = {}) {
  if (DRY) {
    console.log(`[dry-run] ${cmd} ${args.join(' ')}`);
    return '';
  }
  return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...opts });
}

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(v.trim());
  if (!m) throw new Error(`Not a semver version: "${v}"`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function bump(v, kind) {
  const p = parseSemver(v);
  if (kind === 'major') return `${p.major + 1}.0.0`;
  if (kind === 'minor') return `${p.major}.${p.minor + 1}.0`;
  return `${p.major}.${p.minor}.${p.patch + 1}`;
}

// --- 1. Read current version (package.json is the source of truth;
//         tauri.conf.json reads it via "version": "../package.json") ---
const pkgPath = path.join(ROOT, 'package.json');
const pkgLockPath = path.join(ROOT, 'package-lock.json');
const cargoPath = path.join(ROOT, 'src-tauri', 'Cargo.toml');
const cargoLockPath = path.join(ROOT, 'src-tauri', 'Cargo.lock');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const next = bump(pkg.version, KIND);
console.log(`Bumping ${pkg.version} -> ${next} (${KIND})`);

// --- 2. package.json ---
pkg.version = next;
if (!DRY) fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// --- 3. package-lock.json (root entries only, never touch dep versions) ---
{
  const lock = JSON.parse(fs.readFileSync(pkgLockPath, 'utf8'));
  lock.version = next;
  if (lock.packages?.['']) lock.packages[''].version = next;
  if (!DRY) fs.writeFileSync(pkgLockPath, JSON.stringify(lock, null, 2) + '\n');
}

// --- 4. src-tauri/Cargo.toml ([package] section only) ---
{
  const text = fs.readFileSync(cargoPath, 'utf8');
  const headEnd = text.search(/^\[[^\[]/m); // end of [package] section
  const head = headEnd === -1 ? text : text.slice(0, headEnd);
  const tail = headEnd === -1 ? '' : text.slice(headEnd);
  const replaced = head.replace(
    /^(version\s*=\s*")[^"]+(")/m,
    `$1${next}$2`,
  );
  if (replaced === head) throw new Error('Could not find version in [package] of Cargo.toml');
  if (!DRY) fs.writeFileSync(cargoPath, replaced + tail);
}

// --- 5. src-tauri/Cargo.lock (root `sofia` entry only) ---
{
  const text = fs.readFileSync(cargoLockPath, 'utf8');
  const replaced = text.replace(
    /(\[\[package\]\]\nname = "sofia"\nversion = ")[^"]+(")/,
    `$1${next}$2`,
  );
  if (replaced === text) throw new Error('Could not find sofia entry in Cargo.lock');
  if (!DRY) fs.writeFileSync(cargoLockPath, replaced);
}

// --- 6. Commit + annotated tag ---
const files = ['package.json', 'package-lock.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock'];
sh('git', ['add', '--', ...files]);
sh('git', ['commit', '-m', `chore(release): v${next}`]);
sh('git', ['tag', '-a', `v${next}`, '-m', `v${next}`]);

console.log(`\nDone: v${next} committed and tagged.`);
console.log('Push with:  git push --follow-tags');
console.log('(CI will then build installers and draft a GitHub Release.)');
