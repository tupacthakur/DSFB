import {
  mapRistaCategoryToMenuCategory,
  ristaAnalyticsToMenuEngineering,
} from '@/lib/parsers/ristaAnalyticsToMenuEngineering';
import type { RistaAnalyticsSummary } from '@/lib/server/services/rista/client';

describe('mapRistaCategoryToMenuCategory', () => {
  it('maps gelato POS categories to Desserts', () => {
    expect(mapRistaCategoryToMenuCategory('Timeless Classics')).toBe('Desserts');
    expect(mapRistaCategoryToMenuCategory('Amore Signatures')).toBe('Desserts');
  });

  it('maps beverages separately', () => {
    expect(mapRistaCategoryToMenuCategory('Hot Beverages')).toBe('Beverages');
  });
});

describe('ristaAnalyticsToMenuEngineering', () => {
  it('aggregates SKU sales into menu engineering rows', () => {
    const summaries: RistaAnalyticsSummary[] = [
      {
        period: '2026-05-19',
        items: [
          {
            skuCode: 'NRL_01',
            itemName: 'Royal Kulfi Gelato (100 ML)',
            categoryName: 'Amore Signatures',
            itemTotalNetAmount: 100,
            itemTotalQty: 2,
            itemTotalgrossAmount: 100,
            itemTotalDiscountAmount: 0,
          },
        ],
        categories: [{ name: 'Amore Signatures', amount: 100 }],
      },
      {
        period: '2026-05-20',
        items: [
          {
            skuCode: 'NRL_01',
            itemName: 'Royal Kulfi Gelato (100 ML)',
            categoryName: 'Amore Signatures',
            itemTotalNetAmount: 50,
            itemTotalQty: 1,
            itemTotalgrossAmount: 50,
            itemTotalDiscountAmount: 0,
          },
          {
            skuCode: 'NRL_10',
            itemName: 'Belgian Chocolate Gelato',
            categoryName: 'Timeless Classics',
            itemTotalNetAmount: 200,
            itemTotalQty: 1,
            itemTotalgrossAmount: 220,
            itemTotalDiscountAmount: -20,
          },
        ],
      },
    ];

    const menu = ristaAnalyticsToMenuEngineering(summaries, { storeMarginPct: 66, foodCostPct: 34 });
    expect(menu.itemCount).toBe(2);
    expect(menu.menuItemsForEngineering.every((i) => i.category === 'Desserts')).toBe(true);

    const kulfi = menu.menuItemsForEngineering.find((i) => i.id === 'NRL_01');
    expect(kulfi?.covers).toBe(3);
    expect(kulfi?.revenue).toBe(150);

    expect(menu.categoryPL.some((r) => r.category === 'Desserts' && r.revenue > 0)).toBe(true);
    expect(menu.menuItems.length).toBe(2);
    expect(['stars', 'puzzles', 'plowhorses', 'dogs']).toContain(menu.menuItems[0]?.quadrant);
  });
});
