/**
 * Extensive Rista API live test. Run: npm run rista:test
 * Requires RISTA_API_KEY and RISTA_SECRET_KEY in .env.local or environment.
 */
import { readFileSync, existsSync } from 'fs';
import { createHmac } from 'crypto';
import { resolve } from 'path';

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

loadEnvLocal();

const apiKey = process.env.RISTA_API_KEY;
const secretKey = process.env.RISTA_SECRET_KEY;

if (!apiKey || !secretKey) {
  console.error('Missing RISTA_API_KEY or RISTA_SECRET_KEY in .env.local');
  process.exit(1);
}

function b64(s) {
  return Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signToken() {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64(JSON.stringify({ iss: apiKey, iat: Math.floor(Date.now() / 1000) }));
  const data = `${header}.${payload}`;
  const sig = createHmac('sha256', secretKey).update(data).digest();
  return `${data}.${b64(sig)}`;
}

async function ristaGet(path) {
  const token = signToken();
  const res = await fetch(`https://api.ristaapps.com/v1${path}`, {
    headers: { 'x-api-key': apiKey, 'x-api-token': token, 'content-type': 'application/json' },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const results = { pass: 0, fail: 0, warn: 0 };

function log(icon, label, detail) {
  console.log(`${icon} ${label}${detail ? ` — ${detail}` : ''}`);
}

async function run() {
  console.log('\n=== Rista Live API Test ===\n');

  const branches = await ristaGet('/branch/list');
  if (branches.status === 200 && Array.isArray(branches.body)) {
    results.pass++;
    log('✓', 'branch/list', `${branches.body.length} active outlets`);
    for (const b of branches.body.slice(0, 5)) {
      console.log(`    · ${b.branchName} (${b.branchCode}) — ${b.status}`);
    }
  } else {
    results.fail++;
    log('✗', 'branch/list', `HTTP ${branches.status}`);
  }

  const code = branches.body?.[0]?.branchCode ?? 'LKW';
  const day = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const salesPage = await ristaGet(`/sales/page?branchCode=${encodeURIComponent(code)}&day=${day}`);
  if (salesPage.status === 200) {
    results.pass++;
    const count = Array.isArray(salesPage.body?.data) ? salesPage.body.data.length : 0;
    log('✓', 'sales/page', `${count} sale(s) on ${day} for ${code}`);
  } else if (salesPage.status === 403) {
    results.warn++;
    log('!', 'sales/page', '403 — Sales Enterprise + API licence required on this key');
  } else {
    results.fail++;
    log('✗', 'sales/page', `HTTP ${salesPage.status}`);
  }

  const localStatus = await fetch('http://localhost:3000/api/rista/status').catch(() => null);
  if (localStatus?.ok) {
    const j = await localStatus.json();
    results.pass++;
    log('✓', 'Koravo /api/rista/status', `${j.branchCount} branches, salesLicensed=${j.salesApiLicensed}`);
  } else {
    results.warn++;
    log('!', 'Koravo /api/rista/status', 'Dev server not running — start with npm run dev');
  }

  console.log(`\nSummary: ${results.pass} passed, ${results.warn} warnings, ${results.fail} failed\n`);
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
