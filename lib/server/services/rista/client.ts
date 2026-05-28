import { ApiError } from '@/lib/server/api/errors';
import { createRistaToken, type RistaCredentials } from '@/lib/server/services/rista/auth';

const RISTA_BASE = 'https://api.ristaapps.com/v1';

export interface RistaBranch {
  branchName: string;
  branchCode: string;
  status?: string;
  businessName?: string;
}

export interface RistaSale {
  branchCode?: string;
  branchName?: string;
  invoiceDay?: string;
  status?: string;
  netAmount?: number;
  grossAmount?: number;
  totalAmount?: number;
  totalMaterialCost?: number;
  totalCost?: number;
  itemCount?: number;
  personCount?: number;
  customer?: { id?: string; phoneNumber?: string };
}

export interface RistaSalesPage {
  data?: RistaSale[];
  lastKey?: string;
}

async function ristaRequest<T>(
  creds: RistaCredentials,
  path: string,
  options?: { method?: string; jti?: string }
): Promise<T> {
  const token = createRistaToken(creds.apiKey, creds.secretKey, options?.jti);
  const res = await fetch(`${RISTA_BASE}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      'x-api-key': creds.apiKey,
      'x-api-token': token,
      'content-type': 'application/json',
    },
    cache: 'no-store',
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }

  if (res.status === 401 || res.status === 403) {
    const msg =
      typeof body === 'object' && body !== null && 'Message' in body
        ? String((body as { Message: string }).Message)
        : 'Rista API denied access. Ensure Sales Enterprise and API licence are active for this key.';
    throw new ApiError(res.status, 'RISTA_FORBIDDEN', msg);
  }

  if (!res.ok) {
    const errMsg =
      typeof body === 'object' && body !== null && 'errors' in body
        ? String((body as { errors: string }).errors)
        : `Rista API error (${res.status})`;
    throw new ApiError(res.status, 'RISTA_API_ERROR', errMsg);
  }

  return body as T;
}

export async function listRistaBranches(creds: RistaCredentials): Promise<RistaBranch[]> {
  const data = await ristaRequest<RistaBranch[]>(creds, '/branch/list');
  return Array.isArray(data) ? data : [];
}

export async function fetchSalesPage(
  creds: RistaCredentials,
  branchCode: string,
  day: string,
  lastKey?: string
): Promise<RistaSalesPage> {
  const params = new URLSearchParams({ branchCode, day });
  if (lastKey) params.set('lastKey', lastKey);
  return ristaRequest<RistaSalesPage>(creds, `/sales/page?${params.toString()}`);
}

export async function fetchAllSalesForDay(
  creds: RistaCredentials,
  branchCode: string,
  day: string
): Promise<RistaSale[]> {
  const all: RistaSale[] = [];
  let lastKey: string | undefined;
  let pages = 0;
  do {
    const page = await fetchSalesPage(creds, branchCode, day, lastKey);
    if (Array.isArray(page.data)) all.push(...page.data);
    lastKey = page.lastKey;
    pages++;
  } while (lastKey && pages < 200);
  return all;
}
