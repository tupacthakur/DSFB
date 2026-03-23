import { Anthropic } from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { SAGE_MODEL } from '@/lib/api/sage';
import { evaluateRules, metricsVsBenchmarksTable, computeFinancialImpact } from '@/lib/symbolic/engine';
import type { FiredRule, SymbolicResult } from '@/lib/symbolic/engine';
import { buildOntologyChains } from '@/lib/symbolic/ontology';
import {
  BENCHMARKS,
  METRIC_LABELS,
  METRIC_UNITS,
  getSev,
  type MetricKey,
} from '@/lib/symbolic/benchmarks';
import { ApiError } from '@/lib/server/api/errors';
import {
  assertAllowedOrigin,
  assertRateLimit,
  getClientIdentifier,
} from '@/lib/server/security/request';
import { logger } from '@/lib/server/observability/logger';
import { resolveAnthropicApiKey } from '@/lib/server/services/anthropic';
import { getRequestId } from '@/lib/server/http/requestContext';
import { recordInteractionAudit } from '@/lib/server/services/analyticsService';

const MAX_MESSAGES = 50;
const SYSTEM_PROMPT_MAX_CHARS = 18000;

interface RestaurantProfile {
  name: string;
  cuisineType: string;
  seatingCapacity: number;
  avgCoversPerWeek: number;
  serviceStyle: string;
  currency: string;
}

const DEFAULT_PROFILE: RestaurantProfile = {
  name: 'Your Restaurant',
  cuisineType: 'Casual Dining',
  seatingCapacity: 80,
  avgCoversPerWeek: 1200,
  serviceStyle: 'Full Service',
  currency: 'INR',
};

type ReasoningMode = 'quick' | 'analysis' | 'diagnostic' | 'report';

const maxTokensByMode: Record<ReasoningMode, number> = {
  quick: 300,
  analysis: 600,
  diagnostic: 1000,
  report: 1500,
};

const modeInstructions: Record<ReasoningMode, string> = {
  quick: `
RESPONSE MODE: QUICK
Maximum 4 sentences. Lead with the direct answer. One supporting data point. One action if relevant. Use rupees (₹) for any amounts.`,
  analysis: `
RESPONSE MODE: ANALYSIS
Structure: SITUATION → CAUSE → ACTION PLAN. Show at least one formula. Quantify in ₹. 150-250 words. Indian F&B context.`,
  diagnostic: `
RESPONSE MODE: DIAGNOSTIC
Structure:
## Diagnosis
## Root Cause Analysis
## Financial Impact (show calculations in ₹)
## Prioritized Action Plan
## Expected Outcome (with timeline)
250-400 words. Cite all relevant symbolic rules.`,
  report: `
RESPONSE MODE: EXECUTIVE REPORT
Structure:
## Executive Summary (3 sentences)
## Key Findings (bullet points with data)
## Financial Analysis (full calculations in ₹)
## Risk Assessment
## 30-Day Action Plan
## KPIs to Monitor
400-600 words. Full quantification in rupees. Format for a CEO or CFO audience. Indian restaurant context.`,
};

function detectReasoningMode(lastMessage: string): ReasoningMode {
  const msg = lastMessage.toLowerCase();
  if (
    msg.includes('report') ||
    msg.includes('full diagnostic') ||
    msg.includes('executive summary') ||
    msg.includes('comprehensive')
  )
    return 'report';
  if (
    msg.includes('why') ||
    msg.includes('analyze') ||
    msg.includes('analysis') ||
    msg.includes('diagnose') ||
    msg.includes('deep dive') ||
    msg.includes('explain')
  )
    return 'diagnostic';
  if (
    msg.includes('suggest') ||
    msg.includes('how') ||
    msg.includes('what should') ||
    msg.includes('recommend')
  )
    return 'analysis';
  return 'quick';
}

interface RequestBody {
  messages?: unknown;
  metrics?: unknown;
  sessionId?: unknown;
  stream?: unknown;
  context?: unknown;
  systemAddition?: string;
  restaurantProfile?: RestaurantProfile;
  clientApiKey?: string;
}

const DEFAULT_METRICS: Record<string, number> = {
  food_cost: 30, labor_cost: 30, bev_margin: 65, table_turns: 2.5, avg_check: 25,
  waste_pct: 5, prime_cost: 60, sat_score: 4.2, no_shows: 10, repeat_rate: 35,
};

function validateBody(body: unknown): { error?: string; data?: ValidatedBody } {
  if (!body || typeof body !== 'object') return { error: 'Invalid body' };
  const b = body as Record<string, unknown>;
  const messages = b.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { error: 'messages must be a non-empty array' };
  }
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || typeof m !== 'object') return { error: `messages[${i}] must be an object` };
    const role = (m as Record<string, unknown>).role;
    const content = (m as Record<string, unknown>).content;
    if (role !== 'user' && role !== 'assistant') return { error: `messages[${i}].role must be 'user' or 'assistant'` };
    if (typeof content !== 'string') return { error: `messages[${i}].content must be a string` };
    if (content.trim() === '') return { error: `messages[${i}].content must be a non-empty string` };
  }
  let finalMessages = messages as { role: 'user' | 'assistant'; content: string }[];
  if (finalMessages.length > MAX_MESSAGES) {
    finalMessages = [finalMessages[0]!, ...finalMessages.slice(-MAX_MESSAGES + 1)];
  }
  let metrics: Record<string, number>;
  const rawMetrics = b.metrics;
  if (!rawMetrics || typeof rawMetrics !== 'object' || Array.isArray(rawMetrics)) {
    metrics = { ...DEFAULT_METRICS };
  } else {
    const obj = rawMetrics as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      metrics = { ...DEFAULT_METRICS };
    } else {
      metrics = { ...DEFAULT_METRICS };
      for (const k of keys) {
        const v = obj[k];
        if (typeof v === 'number' && Number.isFinite(v)) metrics[k] = v;
      }
    }
  }
  const sessionId = b.sessionId;
  if (typeof sessionId !== 'string' || sessionId.trim() === '') {
    return { error: 'sessionId must be a non-empty string' };
  }
  const stream: boolean = typeof b.stream === 'boolean' ? b.stream : true;
  let context: ValidatedBody['context'] = undefined;
  if (b.context != null && typeof b.context === 'object' && !Array.isArray(b.context)) {
    const ctx = b.context as Record<string, unknown>;
    const ingestedSummary = typeof ctx.ingestedSummary === 'string' ? ctx.ingestedSummary.slice(0, 2000) : undefined;
    const dataContext = typeof ctx.dataContext === 'string' ? ctx.dataContext.slice(0, 3000) : undefined;
    if (ingestedSummary || dataContext) context = { ingestedSummary, dataContext };
  }
  const systemAddition = typeof b.systemAddition === 'string' ? b.systemAddition.slice(0, 4000) : undefined;
  let restaurantProfile: RestaurantProfile = DEFAULT_PROFILE;
  if (b.restaurantProfile != null && typeof b.restaurantProfile === 'object' && !Array.isArray(b.restaurantProfile)) {
    const p = b.restaurantProfile as Record<string, unknown>;
    restaurantProfile = {
      name: typeof p.name === 'string' ? p.name : DEFAULT_PROFILE.name,
      cuisineType: typeof p.cuisineType === 'string' ? p.cuisineType : DEFAULT_PROFILE.cuisineType,
      seatingCapacity: typeof p.seatingCapacity === 'number' ? p.seatingCapacity : DEFAULT_PROFILE.seatingCapacity,
      avgCoversPerWeek: typeof p.avgCoversPerWeek === 'number' ? p.avgCoversPerWeek : DEFAULT_PROFILE.avgCoversPerWeek,
      serviceStyle: typeof p.serviceStyle === 'string' ? p.serviceStyle : DEFAULT_PROFILE.serviceStyle,
      currency: typeof p.currency === 'string' ? p.currency : DEFAULT_PROFILE.currency,
    };
  }
  return {
    data: {
      messages: finalMessages,
      metrics,
      sessionId: sessionId.trim(),
      stream,
      context,
      systemAddition,
      restaurantProfile,
    },
  };
}

interface ValidatedBody {
  messages: { role: 'user' | 'assistant'; content: string }[];
  metrics: Record<string, number>;
  sessionId: string;
  stream: boolean;
  context?: { ingestedSummary?: string; dataContext?: string };
  systemAddition?: string;
  restaurantProfile: RestaurantProfile;
}

function buildSystemPrompt(
  metrics: Record<string, number>,
  symbolicResult: SymbolicResult,
  restaurantProfile: RestaurantProfile,
  reasoningMode: ReasoningMode,
  context?: { ingestedSummary?: string; dataContext?: string }
): string {
  const weeklyRevenue =
    (restaurantProfile.avgCoversPerWeek || 0) * (metrics.avg_check || 28);
  const avgCheck = metrics.avg_check ?? 28;
  const seats = restaurantProfile.seatingCapacity ?? 80;

  const metricsTableLines = (Object.keys(BENCHMARKS) as MetricKey[])
    .filter((key) => metrics[key] != null)
    .map((key) => {
      const val = metrics[key]!;
      const b = BENCHMARKS[key];
      if (!b) return '';
      const delta = val - b.ideal;
      const deltaStr = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
      const status = getSev(key, val);
      const impact = computeFinancialImpact(key, val, b.ideal, weeklyRevenue, {
        avgCheck,
        seats,
      });
      const label = METRIC_LABELS[key];
      const unit = METRIC_UNITS[key];
      return `• ${label}: ${val}${unit} | Ideal: ${b.ideal}${unit} | Delta: ${deltaStr}${unit} | Status: ${status.toUpperCase()} | Est. weekly impact: ${impact}`;
    })
    .filter(Boolean);

  const ontologyChains = buildOntologyChains(symbolicResult.fired);

  const sectionA = `You are SAGE — the Symbolic-Augmented Gastronomy Engine inside Koravo. You are not a general-purpose assistant. You are a specialist F&B operations intelligence system that reasons using a strict two-layer architecture:

LAYER 1 — SYMBOLIC (pre-computed, injected, authoritative):
Hard rules, benchmark violations, ontological dependency chains. These are facts. You do not question them. You build on them.

LAYER 2 — NEURAL (your reasoning):
Causal inference, financial quantification, strategic synthesis, narrative explanation. You EXTEND the symbolic layer — you never contradict it.

Your reasoning follows this chain for every response:
OBSERVE (what do the metrics say) → DIAGNOSE (which symbolic rules fired and why) → TRACE (what causal chain produced this) → QUANTIFY (what is the financial impact in rupees) → PRESCRIBE (what specific actions fix it, in priority order) → FORECAST (what happens if unaddressed vs if addressed)

All monetary figures must be in Indian Rupees (₹). Indian F&B context.`;

  const sectionB = `## CORE F&B FORMULAE (use these in every relevant response)

### Prime Cost
Prime Cost = Food Cost % + Labor Cost %
Prime Cost ₹ = (Food Cost % / 100 × Revenue) + Labor ₹
Target: ≤ 60% for fine dining, ≤ 65% for casual, ≤ 55% for QSR
Critical breach: > 70% — operation is likely loss-making

### Food Cost Percentage
Food Cost % = (COGS / Revenue) × 100
COGS = Opening Inventory + Purchases − Closing Inventory
Ideal range: 25–32% fine dining, 28–35% casual, 22–28% QSR, 18–24% beverages
Variance formula: Actual FC% − Theoretical FC%
If variance > 3%: investigate theft, waste, or portioning

### Labor Cost Percentage
Labor Cost % = (Total Labor ₹ / Revenue) × 100
Total Labor = Wages + Benefits + Payroll Tax + Overtime
Ideal: 28–35% combined (FOH + BOH)
BOH target: 16–22%, FOH target: 12–18%
Labor efficiency ratio = Revenue / Labor Hours Worked
Benchmark: ₹3,200–₹5,200 revenue per labor hour (Indian context)

### Beverage Margin
Bev Margin % = ((Bev Revenue − Bev Cost) / Bev Revenue) × 100
Liquor cost target: 18–24%
Wine cost target: 28–35%
Beer cost target: 22–28%
Bar margin should be 70–80% — high margin offsets lower kitchen margins

### Table Turn Rate
Turns = Covers Served / Seat Count
Revenue per seat = Turns × Avg Check
Optimal: 2.5–4.0 turns for casual, 1.5–2.0 fine dining
Turn time optimization: every 10-min reduction in turn time at 100 seats = ~2 additional turns/week

### RevPASH (Revenue Per Available Seat Hour)
RevPASH = Revenue / (Seats × Operating Hours)
Industry benchmark: ₹650–₹1,200 casual, ₹1,600–₹3,200 fine dining (INR)
This is the single most important throughput metric.

### Menu Engineering (BCG Matrix for F&B)
Contribution Margin (CM) = Selling Price − Food Cost ₹
Menu Item Score = CM × Volume
Stars: High CM, High Volume → protect, feature prominently
Plowhorses: Low CM, High Volume → reduce cost or reprice
Puzzles: High CM, Low Volume → reposition, retrain staff
Dogs: Low CM, Low Volume → remove or fundamentally redesign
Menu mix % = Item Sales / Total Sales
Weighted avg CM = Σ(CM × Menu Mix %) for all items

### Waste Percentage
Waste % = (Waste Value / Purchases Value) × 100
Target: < 3% fine dining, < 5% casual
Every 1% reduction in waste on ₹80,000/week purchases = ₹800/week = ₹41,600/year

### Customer Acquisition vs Retention Cost
Repeat customer cost: 5× cheaper to retain than acquire
Repeat rate target: > 40%
Each 1% increase in repeat rate at 200 covers/week = 2 additional returning covers × avg check = ~₹550–700/week additional revenue

### Break-Even Analysis
Break-Even Covers = Fixed Costs / Contribution Margin per Cover
Contribution Margin per Cover = Avg Check × (1 − Variable Cost %)
Variable costs: food, beverage, some labor
Fixed costs: rent, insurance, salaried staff, utilities

### Profitability Cascade
Revenue − Food Cost (target 30%) = Gross Profit
− Labor Cost (target 30%) = Prime Profit
− Operating Expenses (target 15%) = EBITDA (target 15–20%)
− D&A, Interest, Tax = Net Profit (target 5–10%)

## INDUSTRY BENCHMARKS (cite these when relevant)
Single independent restaurant: Net margin 3–9%
Multi-unit chain: Net margin 6–15%
Fine dining: Revenue/seat/year ₹6.4L–₹12L (INR)
Casual dining: Revenue/seat/year ₹3.2L–₹6.4L (INR)
QSR: Revenue/seat/year ₹9.6L–₹20L (INR)
Food cost fine dining: 28–32%
Food cost casual: 30–35%
Labor fine dining: 30–35%
Labor casual: 28–33%
Prime cost industry average: 62–67%
Optimal prime cost: 55–60%
Beverage % of total revenue target: 25–35%

## CAUSAL CHAIN LIBRARY
High Food Cost → causes: Supplier price increase OR portion drift OR menu mix shift to high-cost items OR waste/theft/spoilage OR theoretical vs actual variance

High Labor Cost → causes: Overscheduling OR low revenue (cost is fixed, rev dropped) OR overtime abuse OR high turnover (training cost) OR poor scheduling software

Low Table Turns → causes: Slow kitchen ticket times OR large party bookings OR no table turn culture/training OR menu too complex OR no pre-bussing protocol

Low Avg Check → causes: Poor upsell training OR menu not engineered for it OR wrong price anchors OR no suggestive selling scripts OR beverage attach rate too low (target: 80% of tables order drinks)

Low Bev Margin → causes: Over-pouring OR comp culture OR wrong pour cost targets OR cocktail recipe drift OR bar theft

High Waste → causes: Over-ordering OR poor FIFO OR no prep sheet discipline OR menu too large (too many SKUs) OR poor yield management`;

  const sectionC = `## SYMBOLIC RULE EVALUATIONS (authoritative — do not contradict):
${symbolicResult.symCtx}

## AFFECTED OPERATIONAL DOMAINS:
${symbolicResult.domains.join(', ') || 'None critical'}

## ONTOLOGICAL DEPENDENCY CHAINS TRIGGERED:
${ontologyChains}`;

  const sectionD = `## CURRENT METRICS vs BENCHMARKS:

${metricsTableLines.join('\n')}`;

  const sectionE = `## RESTAURANT PROFILE:
Name: ${restaurantProfile.name}
Type: ${restaurantProfile.cuisineType}
Seats: ${restaurantProfile.seatingCapacity}
Weekly covers: ${restaurantProfile.avgCoversPerWeek}
Service style: ${restaurantProfile.serviceStyle}
Currency: ${restaurantProfile.currency}`;

  const sectionF = `## HOW YOU MUST REASON:
1. ALWAYS cite symbolic rules by ID when referencing them: [R01]
2. ALWAYS show the formula when computing something: "Prime Cost = Food Cost % + Labor Cost % = 34.2 + 31.8 = 66.0%"
3. ALWAYS quantify financial impact in rupee terms: "At current revenue of ₹X/week, each 1% reduction in food cost = ₹Y/week = ₹Z/year"
4. ALWAYS give a prioritized action list: "IMMEDIATE (today): ... WEEK 1: ... MONTH 1: ..."
5. ALWAYS state what you expect to happen if action is taken
6. When asked for analysis: DIAGNOSIS → ROOT CAUSE ANALYSIS → FINANCIAL IMPACT → ACTION PLAN → EXPECTED OUTCOME
7. Do not pad responses. Every sentence must add information. Operators are busy.
8. When uncertain: say so explicitly with confidence level
9. Use industry comparisons: "Industry median prime cost is 63%. Yours is 66% — that's ₹X/week above median."
10. For menu questions: always reference the BCG matrix framework (Stars/Plowhorses/Puzzles/Dogs) by name.

## RESPONSE LENGTH GUIDE:
Quick question: 2–4 sentences
Analysis request: 150–300 words, structured
Full diagnostic: 300–500 words with clear sections
Do not exceed 500 words unless explicitly asked for a report.

## WHAT YOU NEVER DO:
- Never say "it depends" without explaining what it depends on
- Never give a suggestion without a formula or data backing it
- Never ignore a fired symbolic rule in your response
- Never give the same generic advice twice in a session
- Never round financial figures — show the calculation
${modeInstructions[reasoningMode]}`;

  let prompt = [
    'SECTION A: IDENTITY & EPISTEMOLOGY',
    sectionA,
    'SECTION B: F&B DOMAIN KNOWLEDGE BASE',
    sectionB,
    'SECTION C: LIVE SYMBOLIC LAYER OUTPUT',
    sectionC,
    'SECTION D: LIVE METRICS WITH BENCHMARK DELTAS',
    sectionD,
    'SECTION E: RESTAURANT CONTEXT',
    sectionE,
    'SECTION F: REASONING PROTOCOL',
    sectionF,
  ].join('\n\n');

  if (context?.dataContext) {
    prompt += `\n\n## ADDITIONAL DATA CONTEXT (use for chat and ingested data):\n${context.dataContext}`;
  }
  if (context?.ingestedSummary) {
    prompt += `\n\n## INGESTED DATA SUMMARY:\n${context.ingestedSummary}`;
  }
  if (prompt.length > SYSTEM_PROMPT_MAX_CHARS) {
    prompt = prompt.slice(0, SYSTEM_PROMPT_MAX_CHARS) + '\n[... truncated]';
  }
  return prompt;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers);
  let body: RequestBody;
  try {
    assertAllowedOrigin(request.headers.get('origin'));
    assertRateLimit(getClientIdentifier(request.headers));
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', detail: 'Invalid JSON body' },
      { status: 400, headers: { 'X-Request-Id': requestId } }
    );
  }

  let apiKey: string;
  try {
    apiKey = resolveAnthropicApiKey(body.clientApiKey);
  } catch {
    return NextResponse.json(
      {
        error: 'NO_API_KEY',
        message: 'No API key configured. Set ANTHROPIC_API_KEY in environment or enter it in Settings.',
      },
      { status: 503, headers: { 'X-Request-Id': requestId } }
    );
  }

  const validation = validateBody(body);
  if (validation.error) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', detail: validation.error },
      { status: 400, headers: { 'X-Request-Id': requestId } }
    );
  }
  const { messages, metrics, sessionId, stream: wantStream, context, systemAddition, restaurantProfile } = validation.data!;

  const result = evaluateRules(metrics);
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const reasoningMode = detectReasoningMode(lastUserMessage);
  let systemPrompt = buildSystemPrompt(metrics, result, restaurantProfile, reasoningMode, context);
  if (systemAddition?.trim()) {
    systemPrompt += '\n\n' + systemAddition.trim();
  }
  const maxTokens = systemAddition ? 2000 : maxTokensByMode[reasoningMode];

  const anthropic = new Anthropic({ apiKey });

  try {
    if (wantStream) {
      const stream = await anthropic.messages.stream({
        model: SAGE_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of stream) {
              if (event.type === 'content_block_delta' && event.delta && 'text' in event.delta) {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'delta', text: (event.delta as { text: string }).text }) + '\n'));
              }
            }
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', firedRules: result.fired, domains: result.domains }) + '\n'));
          } catch (err) {
            if (err instanceof Error) {
              controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', error: err.message }) + '\n'));
            }
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Request-Id': requestId,
        },
      });
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await anthropic.messages.create({
          model: SAGE_MODEL,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });
        const text = response.content.filter((c): c is { type: 'text'; text: string } => c.type === 'text').map((c) => c.text).join('');
        await recordInteractionAudit({
          requestId,
          sessionId,
          route: '/api/sage',
          model: SAGE_MODEL,
          promptChars: systemPrompt.length,
          responseChars: text.length,
          status: 'ok',
        });
        return NextResponse.json({
          text,
          firedRules: result.fired,
          domains: result.domains,
          usage: response.usage,
        }, { headers: { 'X-Request-Id': requestId } });
      } catch (err) {
        lastError = err;
        const isRetryable =
          (err as { status?: number })?.status === 429 ||
          (err as { status?: number })?.status === 503;
        if (!isRetryable || attempt === 2) break;
        await new Promise((r) => setTimeout(r, attempt === 0 ? 1000 : 2000));
      }
    }

    throw lastError;
  } catch (err: unknown) {
    const errObj = err as { status?: number; message?: string; name?: string };
    if (errObj?.name === 'AuthenticationError' || errObj?.status === 401) {
      void recordInteractionAudit({
        requestId,
        sessionId,
        route: '/api/sage',
        model: SAGE_MODEL,
        promptChars: systemPrompt.length,
        responseChars: 0,
        status: 'error',
        errorCode: 'INVALID_API_KEY',
      });
      return NextResponse.json({ error: 'INVALID_API_KEY' }, { status: 401, headers: { 'X-Request-Id': requestId } });
    }
    if (errObj?.name === 'RateLimitError' || errObj?.status === 429) {
      return NextResponse.json({ error: 'ANTHROPIC_RATE_LIMIT', retryAfter: 30 }, { status: 429, headers: { 'X-Request-Id': requestId } });
    }
    if (errObj?.name === 'APIError' || (errObj?.status && errObj.status >= 500)) {
      return NextResponse.json(
        { error: 'API_ERROR', message: errObj?.message ?? 'Anthropic API error' },
        { status: 502, headers: { 'X-Request-Id': requestId } }
      );
    }
    if (err instanceof TypeError && err.message?.includes('fetch')) {
      return NextResponse.json({ error: 'NETWORK_ERROR' }, { status: 503, headers: { 'X-Request-Id': requestId } });
    }
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status, headers: { 'X-Request-Id': requestId } });
    }
    logger.error('SAGE route error', {
      message: errObj?.message ?? 'Unknown error',
      status: errObj?.status,
      sessionId,
      requestId,
    });
    return NextResponse.json({ error: 'UNKNOWN_ERROR' }, { status: 500, headers: { 'X-Request-Id': requestId } });
  }
}
