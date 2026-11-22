#!/usr/bin/env node
// Wires angular-pwa-kit (Tailwind + DaisyUI PostCSS config, kit manifest, Path A GitHub Actions workflow,
// and vendored kit modules) into an existing standalone Angular workspace directory.

const fs = require('fs');
const path = require('path');
const { syncNgKit } = require('./sync-ng-kit.cjs');

const KIT_ROOT = path.resolve(__dirname, '..');
const REPOS_ROOT = path.resolve(KIT_ROOT, '..');
const KIT_PKG = JSON.parse(fs.readFileSync(path.join(KIT_ROOT, 'package.json'), 'utf8'));

const ALL_MODULES = [
  'theme.css',
  'dates.ts',
  'ics.ts',
  'idb.ts',
  'storage-utils.ts',
  'chart-kit.ts',
  'theme.service.ts',
  'toast.service.ts',
  'toast.component.ts',
  'confirm-dialog.service.ts',
  'confirm-dialog.component.ts',
  'timer.service.ts',
  'timer-bar.component.ts',
  'app-shell.component.ts',
];

function printHelp() {
  console.log(`Usage: new-ng-pwa <slug|path> [--name <title>] [--port <number>]

Configures angular-pwa-kit.json, .postcssrc.json, GitHub Pages Path A deploy workflow,
and syncs src/app/kit/ inside a standalone Angular app directory.`);
}

function titleFromSlug(slug) {
  return slug.split(/[-_]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function wireAngularPwa(argv = process.argv.slice(2)) {
  if (!argv.length || argv.includes('-h') || argv.includes('--help')) {
    printHelp();
    return;
  }
  let targetArg = null;
  let name = null;
  let port = 4177;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--name') name = argv[++i];
    else if (a === '--port') port = Number.parseInt(argv[++i], 10);
    else if (!targetArg && !a.startsWith('-')) targetArg = a;
    else throw new Error(`Unexpected argument: ${a}`);
  }
  if (!targetArg) throw new Error('App slug or directory is required.');

  const outDir = path.isAbsolute(targetArg) || targetArg.includes('\\') || targetArg.includes('/')
    ? path.resolve(targetArg)
    : path.join(REPOS_ROOT, targetArg);
  const slug = path.basename(outDir);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const manifestPath = path.join(outDir, 'angular-pwa-kit.json');
  const manifest = {
    kitVersion: KIT_PKG.version,
    app: slug,
    name: name || titleFromSlug(slug),
    port,
    target: 'src/app/kit',
    modules: ALL_MODULES,
    syncedAt: new Date().toISOString().slice(0, 10),
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const postcssPath = path.join(outDir, '.postcssrc.json');
  if (!fs.existsSync(postcssPath)) {
    fs.writeFileSync(postcssPath, `${JSON.stringify({ plugins: { '@tailwindcss/postcss': { optimize: { minify: true } } } }, null, 2)}\n`);
  }

  const wfDir = path.join(outDir, '.github', 'workflows');
  fs.mkdirSync(wfDir, { recursive: true });
  const wfPath = path.join(wfDir, 'deploy.yml');
  if (!fs.existsSync(wfPath)) {
    const raw = fs.readFileSync(path.join(KIT_ROOT, 'tooling', 'github-pages-deploy.yml'), 'utf8');
    fs.writeFileSync(wfPath, raw.replaceAll('{{SLUG}}', slug));
  }

  syncNgKit(['--app', outDir]);

  const stylesPath = path.join(outDir, 'src', 'styles.css');
  if (fs.existsSync(path.dirname(stylesPath)) && !fs.existsSync(stylesPath)) {
    fs.writeFileSync(stylesPath, '@import "./app/kit/theme.css";\n');
  }
}

if (require.main === module) {
  try {
    wireAngularPwa();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { wireAngularPwa, ALL_MODULES };
