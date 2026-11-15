// Hands the frontend in. This program runs on Node 22 with the standard
// library only, inside a sandbox with no network: it copies this repo's app/
// (the static frontend) and screenshots/ (its three live-data screenshots)
// into the output directory, then writes dossier.json there with the vendored
// make.fun dossier builder. The grader runs it twice and both runs must
// produce the same bytes, so nothing here depends on the clock or the network.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

// The repository root: the directory this file lives in.
const repoRoot = dirname(fileURLToPath(import.meta.url));

// Where the entry goes. The grader provides /output; a local run overrides it.
const targetDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyIfPresent(name) {
  const from = join(repoRoot, name);
  if (!existsSync(from)) return;
  cpSync(from, join(targetDir, name), { recursive: true });
}

mkdirSync(targetDir, { recursive: true });
copyIfPresent('app');
mkdirSync(join(targetDir, 'screenshots'), { recursive: true });
copyIfPresent('screenshots');

// The gate's own caps for the dossier: at most 3 screenshots, each at most
// 256 KiB; app/ at most 993 files and directories and 16 MiB in all; the
// dossier text at most 160 KiB. The builder refuses anything past them.
const dossierText = buildDossier(targetDir, {
  text_max_bytes: 163840,
  screenshots: { max: 3, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 16777216,
});
writeFileSync(join(targetDir, 'dossier.json'), dossierText);

// One line on stdout so a local run shows what it handed in.
console.log(`wrote ${targetDir} (app/, screenshots/, dossier.json ${dossierText.length} bytes)`);
