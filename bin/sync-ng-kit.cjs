#!/usr/bin/env node
// Syncs vendored angular-pwa-kit files into Angular apps configured with angular-pwa-kit.json.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KIT_ROOT = path.resolve(__dirname, '..');
const REPOS_ROOT = path.resolve(KIT_ROOT, '..');
const KIT_PKG = JSON.parse(fs.readFileSync(path.join(KIT_ROOT, 'package.json'), 'utf8'));

function printHelp() {
  console.log(`Usage: sync-ng-kit [options]

Checks or updates vendored angular-pwa-kit files (src/app/kit/) inside apps with angular-pwa-kit.json.
Never modifies app-specific features, models, tests, or styles beyond src/app/kit/.

Options:
  --check            Verify SHA-256 hashes and exit 1 if any app has drift (read-only)
  --dry-run          Print planned file copies without modifying anything
  --app <slug|path>  Target one specific app instead of scanning ${REPOS_ROOT}
  --all              Scan and sync all apps with angular-pwa-kit.json (default)
  -h, --help         Show this help message`);
}

function parseArgs(argv) {
  const opts = { check: false, dryRun: false, app: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') opts.check = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--all') opts.app = null;
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a === '--app') {
      const next = argv[++i];
      if (!next || next.startsWith('-')) throw new Error('Missing value for --app.');
      opts.app = next;
    } else if (a.startsWith('--app=')) {
      opts.app = a.slice('--app='.length);
    } else {
      throw new Error(`Unknown option: ${a}`);
    }
  }
  return opts;
}

const sha256 = filePath => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

function findTargets(appArg) {
  if (appArg) {
    const resolved = path.isAbsolute(appArg) || appArg.includes('\\') || appArg.includes('/')
      ? path.resolve(appArg)
      : path.join(REPOS_ROOT, appArg);
    if (!fs.existsSync(path.join(resolved, 'angular-pwa-kit.json'))) {
      throw new Error(`No angular-pwa-kit.json found in ${resolved}`);
    }
    return [resolved];
  }
  const found = [];
  if (!fs.existsSync(REPOS_ROOT)) return found;
  for (const entry of fs.readdirSync(REPOS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(REPOS_ROOT, entry.name);
    if (dir === KIT_ROOT) continue;
    if (fs.existsSync(path.join(dir, 'angular-pwa-kit.json'))) found.push(dir);
  }
  return found;
}

function inspectApp(appDir) {
  const cfgPath = path.join(appDir, 'angular-pwa-kit.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const targetDir = cfg.target || 'src/app/kit';
  const pairs = (cfg.modules || []).map(f => ({
    src: path.join(KIT_ROOT, 'kit', f),
    dst: path.join(appDir, targetDir, f),
    label: `${targetDir}/${f}`,
  }));

  const drift = [];
  for (const pair of pairs) {
    if (!fs.existsSync(pair.src)) throw new Error(`Missing source kit file: ${pair.src}`);
    if (!fs.existsSync(pair.dst)) {
      drift.push({ ...pair, reason: 'missing' });
    } else if (sha256(pair.src) !== sha256(pair.dst)) {
      drift.push({ ...pair, reason: 'outdated' });
    }
  }
  return { appDir, cfgPath, cfg, drift };
}

function syncNgKit(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (opts.help) {
    printHelp();
    return { driftedApps: 0 };
  }

  const targets = findTargets(opts.app);
  if (!targets.length) {
    console.log('No apps with angular-pwa-kit.json found.');
    return { driftedApps: 0 };
  }

  let driftedApps = 0;
  for (const appDir of targets) {
    const { cfgPath, cfg, drift } = inspectApp(appDir);
    const label = path.basename(appDir);
    if (!drift.length) {
      console.log(`[ok] ${label}: all ${(cfg.modules || []).length} vendored Angular kit files match angular-pwa-kit v${KIT_PKG.version}.`);
      continue;
    }

    driftedApps += 1;
    console.log(`[drift] ${label}: ${drift.length} file(s) differ:`);
    for (const d of drift) console.log(`  - ${d.label} (${d.reason})`);

    if (opts.check) continue;
    if (opts.dryRun) {
      console.log(`  [dry-run] Would copy ${drift.length} file(s).`);
      continue;
    }

    for (const d of drift) {
      fs.mkdirSync(path.dirname(d.dst), { recursive: true });
      fs.copyFileSync(d.src, d.dst);
    }
    cfg.kitVersion = KIT_PKG.version;
    cfg.syncedAt = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
    console.log(`  Synced ${drift.length} file(s) into ${label}.`);
    console.log(`  Reminder: run "npm test && npm run build" in ${label}.`);
  }

  if (opts.check && driftedApps > 0) {
    throw new Error(`${driftedApps} app(s) have outdated vendored Angular kit files.`);
  }
  return { driftedApps };
}

if (require.main === module) {
  try {
    syncNgKit();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { syncNgKit, inspectApp };
