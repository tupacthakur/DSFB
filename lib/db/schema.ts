/**
 * Database schema aligned to datapoints: Sales, Financial, Inventory,
 * and symbolic layer (DiscountCap, MarginFloor, WasteTolerance, PaymentRisk, VendorClass, ShrinkageMetric).
 * Grain: transaction-level for master fact; aggregates for rules.
 */

// ─── Sales (from sales_transactions) ───────────────────────────────────────
export interface SalesRow {
  order_id: string;
  order_date: string;
  order_time: string;
  order_hour: number;
  sku_id: string;
  sku_name: string;
  category: string;
  channel: string;
  region: string;
  distributor_id: string;
  qty_ordered: number;
  qty_delivered: number;
  fulfillment_rate_pct: number;
  is_partial_delivery: boolean;
  unit_cost: number;
  selling_price_per_unit: number;
  discount_pct: number;
  total_revenue: number;
  gross_margin: number;
  payment_status: string;
  days_to_payment: number;
  transaction_type: string;
  return_reason: string | null;
  original_order_id: string | null;
}

// ─── Financial (from financial_tracking) ────────────────────────────────────
export interface FinancialRow {
  transaction_id: string;
  date: string;
  sku_id: string;
  sku_name: string;
  category: string;
  transaction_type: string;
  channel: string;
  region: string;
  quantity: number;
  unit_cost: number;
  selling_price: number;
  total_value: number;
  gross_margin: number;
  discount_pct: number;
  payment_status: string;
  days_to_payment: number;
  reference_id: string | null;
  damage_reason: string | null;
}

// ─── Inventory ─────────────────────────────────────────────────────────────
export interface InventoryRow {
  sku_id: string;
  sku_name: string;
  category: string;
  batch_no: string;
  supplier_id: string;
  supplier_name: string;
  warehouse_id: string;
  manufactured_date: string;
  expiry_date: string;
  shelf_life_days: number;
  shelf_life_remaining_pct: number;
  quantity_in_stock: number;
  unit: string;
  cost_per_unit: number;
  reorder_level: number;
  reorder_quantity: number;
  stock_status: string;
  is_damaged: boolean;
  damaged_qty: number;
  damage_reason: string | null;
  financial_loss_damage: number;
  inventory_turnover_rate: number;
  last_updated: string;
}

// ─── Master fact table (transaction grain) ─────────────────────────────────
export interface MasterFactRow {
  order_id: string;
  order_date: string;
  sku_id: string;
  distributor_id: string;
  region: string;
  channel: string;
  qty_ordered: number;
  selling_price: number;
  discount_pct: number;
  gross_margin: number;
  days_to_payment: number;
  supplier_id?: string;
  warehouse_id?: string;
  transaction_value: number;
  overdue_flag: boolean;
}

// ─── Symbolic layer / Rule outputs (from impl_draft) ────────────────────────
export type ConstraintId =
  | 'DiscountCap'
  | 'MarginFloor'
  | 'WasteTolerance'
  | 'PaymentRisk'
  | 'VendorClass'
  | 'ShrinkageMetric';

export interface DiscountCapAggregate {
  channel: string;
  category: string;
  region: string;
  week: string;
  weekly_avg_discount: number;
  discount_breach: boolean; // discount_pct > policy_cap
}

export interface MarginFloorContext {
  category: string;
  region: string;
  channel: string;
  date: string;
  gross_margin: number;
  rolling_category_margin_30d: number;
  rolling_std_unit_cost: number;
}

export interface WasteToleranceAggregate {
  warehouse_id: string;
  category: string;
  week: string;
  waste_ratio: number; // damaged_qty / quantity_in_stock
}

export interface PaymentRiskContext {
  distributor_id: string;
  overdue_flag: boolean;
  rolling_avg_delay: number;
  rolling_overdue_rate: number;
  payment_volatility: number;
}

export interface VendorClassContext {
  supplier_id: string;
  supplier_name: string;
  total_purchase_value: number;
  price_volatility: number;
  damage_incidents: number;
  sku_count: number;
  vendor_dependency_ratio: number;
}

export interface ShrinkageMetricContext {
  shrinkage_cost_ratio: number; // financial_loss_damage / total_inventory_value
}

// Regime detection (for SAGE / reasoning)
export type RegimeType =
  | 'Supply Shock'
  | 'Demand Shock'
  | 'Competitive Pressure'
  | 'Structural Change'
  | 'Recovery'
  | 'Normal';

export interface RegimeState {
  regime: RegimeType;
  detected_at: string;
  confidence: number;
}

// Fragility score (composite for LLM layer)
export interface FragilityScore {
  payment_risk: number;
  margin_deviation: number;
  waste_anomaly: number;
  supplier_fragility: number;
  regime_stress_factor: number;
  composite: number; // weighted sum
}
