/**
 * Extensive Rista API live test. Run: npm run rista:test
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
  } else {
    results.fail++;
    log('✗', 'branch/list', `HTTP ${branches.status}`);
  }

  const code = branches.body?.[0]?.branchCode ?? 'KVL';
  const day = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const analytics = await ristaGet(
    `/analytics/sales/summary?branch=${encodeURIComponent(code)}&period=${day}`
  );
  if (analytics.status === 200) {
    results.pass++;
    const ch = analytics.body?.channelSummary?.map((c) => c.name).join(', ') ?? '—';
    log('✓', 'analytics/sales/summary', `channels: ${ch}`);
  } else if (analytics.status === 403) {
    results.warn++;
    log('!', 'analytics/sales/summary', '403 forbidden');
  } else {
    results.fail++;
    log('✗', 'analytics/sales/summary', `HTTP ${analytics.status}`);
  }

  const salesPage = await ristaGet(`/sales/page?branchCode=${encodeURIComponent(code)}&day=${day}`);
  if (salesPage.status === 200) {
    results.pass++;
    log('✓', 'sales/page', 'accessible');
  } else if (salesPage.status === 403) {
    results.warn++;
    log('!', 'sales/page', '403 — use analytics endpoint instead');
  } else {
    results.fail++;
    log('✗', 'sales/page', `HTTP ${salesPage.status}`);
  }

  try {
    const localStatus = await fetch('https://dsfb-sepia.vercel.app/api/rista/status', {
      headers: { Origin: 'https://dsfb-sepia.vercel.app' },
    });
    if (localStatus.ok) {
      const j = await localStatus.json();
      results.pass++;
      log('✓', 'Koravo /api/rista/status', `${j.branchCount} branches, salesLicensed=${j.salesApiLicensed}`);
    } else {
      results.warn++;
      log('!', 'Koravo /api/rista/status', `HTTP ${localStatus.status}`);
    }
  } catch {
    results.warn++;
    log('!', 'Koravo /api/rista/status', 'unreachable');
  }

  console.log(`\nSummary: ${results.pass} passed, ${results.warn} warnings, ${results.fail} failed\n`);
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
