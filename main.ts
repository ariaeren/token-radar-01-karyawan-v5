// KARYAWAN-01 / token-radar-01 -- entrypoint (Node 22, standard library only).
//
//   node main.ts --input <snapshot.json|directory> --output <directory>
//
// Defaults: /input and /output, or MAKEFUN_OUTPUT_DIR outside the grader. The program reads the sealed
// snapshot, derives the whole pre-token radar, writes board.json and data.js, copies the static page
// and its three screenshots, and finally writes dossier.json with the vendored make.fun helper. No
// clock, locale, environment-dependent value or absolute path enters an artifact.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const DASHBOARD_CAPS = { max_files: 400, max_bytes: 4_194_304 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}\.(jpg|jpeg|png)$/i;

function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const equal = process.argv.find((a) => a.startsWith(`--${name}=`));
  return equal === undefined ? fallback : equal.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.toLowerCase().endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}; pass --input <snapshot.json|directory>\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: refusing to write an invalid board: ${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ version: radar.model.version, as_of: snapshot.as_of, rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

function copyPlainDirectory(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const names: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const source = join(from, name);
    if (!statSync(source).isFile()) continue;
    copyFileSync(source, join(to, name));
    names.push(name);
  }
  return names;
}

const pageFiles = copyPlainDirectory(join(here, 'dashboard'), join(out, 'dashboard'));
if (!pageFiles.includes('index.html')) {
  process.stderr.write('token radar: dashboard/index.html is missing\n');
  process.exit(1);
}
const shots = copyPlainDirectory(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length !== 3 || shots.some((name) => !IMAGE_NAME.test(name))) {
  process.stderr.write(`token radar: hand in exactly three JPEG or PNG screenshots, got ${shots.length}\n`);
  process.exit(1);
}

// Written last: the scorer rebuilds this file byte for byte from the copied output.
const dossier = buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: DASHBOARD_CAPS });
writeFileSync(join(out, 'dossier.json'), dossier);

process.stdout.write(
  `token radar ${radar.model.version}: ${snapshot.protocols.length} protocols, ${radar.stats.watchlist}/${radar.stats.watchlist} watchlist, ` +
    `${board.length} ranked rows (${radar.stats.below_floor} below the floor), ${radar.stats.live} live tokens set aside\n` +
    `token radar: wrote board.json, data.js, dashboard (${pageFiles.length} files), screenshots (${shots.length} images), dossier.json\n`,
);
