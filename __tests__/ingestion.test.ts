import { preprocessBuffer } from '@/lib/ingestion/preprocess';
import { interpretPayload } from '@/lib/ingestion/interpret';
import { extractRecordsFromText } from '@/lib/ingestion/preprocess/unstructured';
import { ingestFile } from '@/lib/ingestion/ingestFile';

function toBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

describe('ingestion engine', () => {
  it('preprocesses TSV with tab delimiter', () => {
    const text = 'date\trevenue\tcost\n2026-03-01\t1000\t300\n2026-03-02\t1200\t350\n';
    const payload = preprocessBuffer(toBuffer(text), 'sales.tsv');
    expect(payload.format).toBe('tsv');
    expect(payload.rows.length).toBe(2);
    const result = interpretPayload(payload);
    expect(result.daily.length).toBe(2);
  });

  it('extracts unstructured date + amount lines', () => {
    const text = [
      'Daily report',
      '01/03/2026  total sales  ₹12,450.00',
      '02/03/2026  revenue 8,200',
      'noise line without numbers',
    ].join('\n');
    const rows = extractRecordsFromText(text);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const payload = preprocessBuffer(toBuffer(text), 'report.txt');
    expect(payload.rows.length).toBeGreaterThan(0);
    const result = interpretPayload(payload);
    expect(result.daily.length).toBeGreaterThan(0);
  });

  it('preprocesses JSON array of objects', () => {
    const json = JSON.stringify([
      { order_date: '2026-04-01', net_amount: 500 },
      { order_date: '2026-04-02', net_amount: 600 },
    ]);
    const payload = preprocessBuffer(toBuffer(json), 'orders.json');
    expect(payload.format).toBe('json');
    expect(payload.rows.length).toBe(2);
    const result = interpretPayload(payload);
    expect(result.daily.length).toBe(2);
  });

  it('ingestFile rejects empty files', async () => {
    const file = new File([], 'empty.csv', { type: 'text/csv' });
    await expect(ingestFile(file)).rejects.toMatchObject({ code: 'empty' });
  });

  it('accepts headerless numeric grid', async () => {
    const text = '1000,200\n1500,350\n2000,400\n';
    const file = new File([text], 'data.dat', { type: 'application/octet-stream' });
    const result = await ingestFile(file);
    expect(result.daily.length).toBeGreaterThan(0);
  });

  it('accepts key-value sales lines without dates', async () => {
    const text = 'Total Sales: 45,000\nNet Revenue: 38,200\n';
    const file = new File([text], 'report.txt', { type: 'text/plain' });
    const result = await ingestFile(file);
    expect(result.daily.length).toBeGreaterThan(0);
  });

  it('accepts arbitrary extension with numeric lines', async () => {
    const text = 'line noise\namount 1200.50\nanother 980\n';
    const file = new File([text], 'export.xyz', { type: 'application/octet-stream' });
    const result = await ingestFile(file);
    expect(result.daily.length).toBeGreaterThan(0);
  });
});
