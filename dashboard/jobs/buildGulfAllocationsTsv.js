#!/usr/bin/env node
/**
 * Build gulf-telecom-allocations.tsv from raw PDF text (pypdf extract).
 *
 *   node dashboard/jobs/buildGulfAllocationsTsv.js
 *   RAW_FILE=data/gulf-telecom-allocations-raw.txt node dashboard/jobs/buildGulfAllocationsTsv.js
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { normalizeAllocationsPdfText } from '../lib/gulf-allocations-parse.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const rawPath =
  String(process.env.RAW_FILE || '').trim() || join(root, 'data', 'gulf-telecom-allocations-raw.txt');
const outPath = join(root, 'data', 'gulf-telecom-allocations.tsv');

if (!existsSync(rawPath)) {
  console.error('Missing:', rawPath);
  process.exit(1);
}
const raw = readFileSync(rawPath, 'utf8');
const norm = normalizeAllocationsPdfText(raw);
const body = norm
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .join('\n');
const tsv = `Country\tRange\tRate_USD\n${body}\n`;
writeFileSync(outPath, tsv, 'utf8');
const lines = body.split('\n').length;
console.log(JSON.stringify({ ok: true, raw: rawPath, out: outPath, dataRows: lines }));
