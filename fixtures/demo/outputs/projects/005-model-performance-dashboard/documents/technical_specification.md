# Technical Specification: Model Performance Dashboard

## Architecture Overview

Metrics flow from applications via HTTP to an ingestion API, through Redis for burst buffering, into TimescaleDB for storage. The dashboard reads from pre-computed continuous aggregates for fast queries.

```
┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│  Application │────▶│  Ingestion   │────▶│    Redis     │
│  (SDK/HTTP)  │     │  API (Express)│     │   (Queue)   │
└──────────────┘     └──────────────┘     └──────┬──────┘
                                                  │
                     ┌──────────────┐     ┌──────▼──────┐
                     │  React SPA   │◀────│ TimescaleDB │
                     │  (Dashboard) │     │ (Metrics)   │
                     └──────────────┘     └──────┬──────┘
                                                  │
                     ┌──────────────┐     ┌──────▼──────┐
                     │  Slack/Email │◀────│  Alert      │
                     │  (Channels)  │     │  Evaluator  │
                     └──────────────┘     └─────────────┘
```

## Ingestion API

### POST /api/metrics/ingest
Accepts batched metric data points from application SDKs.

**Request:**
```json
{
  "model": "claude-3-opus",
  "endpoint": "/api/chat",
  "metrics": {
    "latency_ms": 1240,
    "input_tokens": 450,
    "output_tokens": 120,
    "status": "success",
    "cost_usd": 0.0089
  },
  "timestamp": "2026-02-24T10:30:00.000Z"
}
```

## Storage Schema

### Hypertable: `model_metrics`
TimescaleDB hypertable partitioned by time.

Columns: timestamp, model, endpoint, latency_ms, input_tokens, output_tokens, status, cost_usd, error_type

### Continuous Aggregates
- `metrics_1min` — 1-minute rollups with p50, p95, p99, avg, count
- `metrics_1hour` — 1-hour rollups for longer time ranges
- `metrics_1day` — Daily rollups for monthly views

## Alert System

Alert rules stored in PostgreSQL. Evaluation runs on two tracks:
- **Critical alerts**: evaluated on each incoming data point via Redis pub/sub
- **Standard alerts**: evaluated every 60 seconds via polling worker

Alert delivery via webhook to Slack API and SendGrid for email.

## Dashboard API

### GET /api/dashboard/overview
Returns summary metrics for all models (current values + trends).

### GET /api/dashboard/metrics/:model
Returns time-series data for a specific model with configurable time range and granularity.

### CRUD /api/dashboard/alerts
Create, read, update, delete alert rules.

### GET /api/dashboard/alerts/history
Returns recent alert triggers with details.

## Performance Targets

| Query | Target | Strategy |
|-------|--------|----------|
| Overview load | <1s | Continuous aggregates + caching |
| Model detail (24h) | <2s | 1-min aggregates, ~1440 points |
| Model detail (30d) | <2s | Hourly aggregates, ~720 points |
| Alert evaluation | <5s | Redis pub/sub for critical path |

---
*Document generated as part of SpecWright specification*
