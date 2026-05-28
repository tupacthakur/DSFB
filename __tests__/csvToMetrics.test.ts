import { parseCsvToMetrics } from '@/lib/parsers/csvToMetrics';

describe('parseCsvToMetrics', () => {
  it('parses Rista sales audit schema and computes daily metrics', () => {
    const csv = [
      '"Branch Name","Business Date","Sale Status","Net Amount","Total","Materials Cost","Number of Tickets","Customer Id"',
      '"Lulu Mall - Lucknow","2026-03-01","Closed","237.14","249","120","1","C1"',
      '"Lulu Mall - Lucknow","2026-03-01","Closed","189.52","199","98","1","C2"',
      '"Lulu Mall - Lucknow","2026-03-02","Voided","0","0","0","0","C2"',
    ].join('\n');

    const result = parseCsvToMetrics(csv);
    expect(result.metadata.schema).toBe('rista_sales_audit');
    expect(result.daily.length).toBe(2);
    expect(result.metadata.dateRange).not.toBeNull();
    expect(result.metadata.skippedRowCount).toBeGreaterThanOrEqual(0);
    expect(result.metadata.branchesDetected).toContain('Lulu Mall - Lucknow');
    expect(result.metrics.avg_check).toBeGreaterThan(0);
    expect(result.metrics.food_cost).toBeGreaterThanOrEqual(0);
  });

  it('parses Swiggy annexure schema with quoted headers', () => {
    const csv = [
      '"RID","Order Date","Customer payable (Net bill value after taxes & discount) F = D + E","Total Swiggy fee (including taxes) S = P + Q + U1","Net Payable Amount (after TCS and TDS deduction) Y = W - X1 - X2"',
      '"582901","2026-03-01 20:32:24","1116.13","263.41","846.35"',
      '"582901","2026-03-02 21:33:55","470.91","111.14","357.11"',
    ].join('\n');

    const result = parseCsvToMetrics(csv);
    expect(result.metadata.schema).toBe('swiggy_annexure');
    expect(result.daily.length).toBe(2);
    expect(result.metadata.dateRange).not.toBeNull();
    expect(result.metadata.warnings.length).toBeGreaterThanOrEqual(0);
    expect(result.metrics.food_cost).toBeGreaterThan(0);
  });

  it('handles multiline quoted fields without breaking row parsing', () => {
    const csv = [
      '"Branch Name","Business Date","Total","Materials Cost","Sale Status","Order Notes"',
      '"Head Office","2026-02-24","210","100","Voided","Printed line one',
      'Printed line two"',
    ].join('\n');

    const result = parseCsvToMetrics(csv);
    expect(result.daily.length).toBe(1);
    expect(result.daily[0].revenue).toBe(210);
  });

  it('returns empty for invalid/generic rows without required fields', () => {
    const csv = ['foo,bar,baz', '1,2,3'].join('\n');
    const result = parseCsvToMetrics(csv);
    expect(result.daily.length).toBe(0);
    expect(result.metadata.schema).toBe('generic');
    expect(result.metadata.warnings.length).toBeGreaterThan(0);
  });

  it('parses multi-warehouse inventory snapshot CSV (SKU × batch × warehouse)', () => {
    const csv = [
      'sku_id,sku_name,batch_no,warehouse_id,quantity_in_stock,cost_per_unit,financial_loss_damage,stock_status,last_updated',
      'SKU-A,Item A,B1,WH-DEL-01,10,100,0,ACTIVE,2026-02-19 10:00:00',
      'SKU-A,Item A,B2,WH-MUM-01,5,100,0,LOW_STOCK,2026-02-19 12:00:00',
      'SKU-B,Item B,B3,WH-DEL-01,2,50,25,DAMAGED,2026-02-20 08:00:00',
    ].join('\n');

    const result = parseCsvToMetrics(csv);
    expect(result.metadata.schema).toBe('inventory_snapshot');
    expect(result.daily.length).toBe(2);
    expect(result.metadata.branchesDetected).toEqual(expect.arrayContaining(['WH-DEL-01', 'WH-MUM-01']));
    const feb19 = result.daily.find((d) => d.date === '2026-02-19');
    expect(feb19).toBeDefined();
    // 10*100 + 5*100 = 1500 value signal; damage 0
    expect(feb19!.revenue).toBe(1500);
    expect(feb19!.covers).toBe(15);
    const feb20 = result.daily.find((d) => d.date === '2026-02-20');
    expect(feb20!.revenue).toBe(100);
    expect(feb20!.cost).toBeGreaterThan(0);
    expect(result.metadata.warnings.some((w) => w.includes('Inventory snapshot'))).toBe(true);
  });
});
