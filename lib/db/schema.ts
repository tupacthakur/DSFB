/**
 * Source-aligned schema contracts for Koravo.
 * These interfaces mirror the real data currently available:
 * 1) Rista POS sales-audit exports
 * 2) Swiggy settlement / annexure exports
 * The grain is order-level, not SKU-level, so downstream analytics should
 * derive KPIs from orders, channels, branches, coupons, payments, and fees.
 */

export interface RistaSalesAuditRow {
  branch_name: string;
  branch_code: string;
  business_brand: string;
  business_date: string;
  invoice_number: string;
  invoice_date: string;
  sale_status: string;
  order_source: string;
  gross_amount: number;
  discounts: number;
  net_amount: number;
  taxes: number;
  total: number;
  paid_amount: number;
  balance_due: number;
  discount_pct: number;
  payment_modes: string;
  materials_cost: number;
  supplies_cost: number;
  channel: string;
  channel_label: string;
  session: string | null;
  number_of_items: number;
  total_quantity: number;
  number_of_people: number;
  number_of_tickets: number;
  number_of_cancelled_tickets: number;
  created_date: string;
  sale_by: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
}

export interface SwiggyAnnexureRow {
  rid: string;
  order_date: string;
  order_no: string;
  order_status: string;
  order_category: string;
  item_total_a: number;
  packing_service_charges_b: number;
  merchant_discount_c: number;
  net_bill_value_d: number;
  gst_liability_e: number;
  customer_payable_f: number;
  platform_fee_pct: number;
  platform_fee_g: number;
  total_swiggy_service_fee_q: number;
  delivery_fee_u1: number;
  taxes_on_swiggy_fee_r: number;
  total_swiggy_fee_s: number;
  total_adjustments_v: number;
  net_payable_before_tax_w: number;
  tcs_x1: number;
  tds_x2: number;
  net_payable_after_tax_y: number;
  coupon_code_applied_by_customer: string | null;
  current_utr: string | null;
  last_mile_distance: number | null;
  parent_order_id: string | null;
}

export interface UnifiedOrderFact {
  source_system: 'rista' | 'swiggy';
  source_order_id: string;
  order_date: string;
  branch_name: string | null;
  branch_code: string | null;
  channel: string;
  order_status: string;
  payment_mode: string | null;
  customer_id: string | null;
  customer_phone: string | null;
  gross_amount: number;
  discount_amount: number;
  tax_amount: number;
  net_sales_amount: number;
  fee_amount: number;
  cost_amount: number;
  final_payout_amount: number;
  order_count: number;
  unit_count: number;
  guest_count: number;
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
  category: string | null;
  region: string | null;
  week: string;
  weekly_avg_discount: number;
  discount_breach: boolean;
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
