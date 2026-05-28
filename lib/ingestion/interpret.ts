import { parseCsvToMetrics } from '@/lib/parsers/csvToMetrics';
import {
  headersLookGeneric,
  inferColumnRoles,
  remapRowsWithRoles,
} from '@/lib/ingestion/columnInference';
import { rowsToCsv } from '@/lib/ingestion/rowsToCsv';
import type {
  ColumnMapping,
  IngestionResult,
  InterpretationReport,
  PreprocessedPayload,
} from '@/lib/ingestion/types';

function buildColumnMapping(headers: string[], roles?: ReturnType<typeof inferColumnRoles>): ColumnMapping {
  if (!roles) {
    return {
      date: headers.find((h) => /date|day/i.test(h)),
      revenue: headers.find((h) => /revenue|sales|amount|total|net/i.test(h)),
      cost: headers.find((h) => /cost|fee|cogs|material/i.test(h)),
      covers: headers.find((h) => /cover|guest|qty|ticket/i.test(h)),
      branch: headers.find((h) => /branch|outlet|store|location/i.test(h)),
    };
  }
  return {
    date: headers[roles.date],
    revenue: headers[roles.revenue],
    cost: roles.cost >= 0 ? headers[roles.cost] : undefined,
    covers: roles.covers >= 0 ? headers[roles.covers] : undefined,
    branch: roles.branch >= 0 ? headers[roles.branch] : undefined,
  };
}

/** Map preprocessed rows → KPIs via schema detection + column inference + csvToMetrics. */
export function interpretPayload(payload: PreprocessedPayload): IngestionResult {
  const steps = [...payload.steps];

  if (payload.rows.length === 0) {
    const empty = parseCsvToMetrics('date,revenue\n');
    return {
      ...empty,
      daily: [],
      metrics: {},
      priorMetrics: {},
      interpretation: {
        format: payload.format,
        steps,
        confidence: 0,
        columnMapping: {},
        detectedSchema: 'generic',
      },
    };
  }

  let headers = payload.headers;
  let rows = payload.rows;
  let confidence = payload.confidence;
  let roles: ReturnType<typeof inferColumnRoles> = null;

  if (headersLookGeneric(headers) || headers.length < 2) {
    roles = inferColumnRoles(headers, rows);
    if (roles) {
      const remapped = remapRowsWithRoles(headers, rows, roles);
      headers = remapped.headers;
      rows = remapped.rows;
      steps.push('Inferred date/revenue columns from cell patterns (headerless or generic file)');
      confidence = Math.min(0.95, confidence + 0.15);
    }
  } else {
    roles = inferColumnRoles(headers, rows);
    const hasDate = headers.some((h) => /date|day/i.test(h));
    const hasRev = headers.some((h) => /revenue|sales|amount|total|net/i.test(h));
    if ((!hasDate || !hasRev) && roles) {
      const remapped = remapRowsWithRoles(headers, rows, roles);
      headers = remapped.headers;
      rows = remapped.rows;
      steps.push('Remapped columns using semantic inference');
      confidence = Math.min(0.95, confidence + 0.1);
    }
  }

  const csv = rowsToCsv(headers, rows);
  steps.push('Normalized to tabular schema for metrics engine');
  const result = parseCsvToMetrics(csv);

  if (result.daily.length > 0) {
    confidence = Math.min(0.98, confidence + 0.1);
  } else if (result.metadata.warnings.length > 0) {
    confidence = Math.max(0.1, confidence - 0.2);
  }

  const columnMapping = buildColumnMapping(headers, roles ?? undefined);
  const interpretation: InterpretationReport = {
    format: payload.format,
    steps,
    confidence,
    columnMapping,
    detectedSchema: result.metadata.schema,
  };

  return { ...result, interpretation };
}
