import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createHmac } from 'crypto';

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
function b64(s) {
  return Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function sign(p, sec) {
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify(p));
  const d = `${h}.${body}`;
  const sig = createHmac('sha256', sec).update(d).digest();
  return `${d}.${b64(sig)}`;
}
async function get(path) {
  const t = sign({ iss: apiKey, iat: Math.floor(Date.now() / 1000) }, secretKey);
  const r = await fetch(`https://api.ristaapps.com/v1${path}`, {
    headers: { 'x-api-key': apiKey, 'x-api-token': t },
  });
  return { status: r.status, body: r.status === 200 ? await r.json() : await r.text() };
}

const branches = (await get('/branch/list')).body;
const day = '2026-05-20';
let total = 0;
let revenue = 0;
for (const b of branches.slice(0, 3)) {
  const row = await get(`/analytics/sales/summary?branch=${encodeURIComponent(b.branchCode)}&period=${day}`);
  if (row.status === 200) {
    total++;
    revenue += Number(row.body.netAmount ?? 0);
    console.log(b.branchName, row.body.channelSummary?.map((c) => c.name).join(', ') || 'no channels');
  }
}
console.log('sample', total, 'branches', 'revenue', revenue);
