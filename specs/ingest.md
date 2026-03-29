---
title: Ingest Spec
module: src/ingest/
---

# Data Ingestion

Import technology datasets into the tenant's registry. CNCF is the primary trusted source. Additional sources can be configured per tenant.

## Ingest Sources
| Source | Format | Schedule | Description |
|--------|--------|----------|-------------|
| `cncf` | YAML | Daily / on-demand | CNCF landscape.yml — categories, subcategories, projects |
| `custom_csv` | CSV | On-demand | Enterprise-defined technology list |
| `custom_json` | JSON | On-demand / webhook | API-driven import |

## Endpoints

### GET /api/ingest/sources
List configured ingest sources for tenant.
Requires: `requireRole(TenantAdmin)`

### POST /api/ingest/sources
Configure a new ingest source.
Requires: `requireRole(TenantAdmin)`

**Request**:
```json
{
  "source_type": "cncf",
  "label": "CNCF Landscape",
  "config": {
    "url": "https://raw.githubusercontent.com/cncf/landscape/master/landscape.yml",
    "schedule": "0 2 * * *",
    "auto_create_capabilities": true,
    "auto_create_technologies": true,
    "default_state": "Emerging"
  }
}
```

### POST /api/ingest/sources/:sourceId/run
Trigger an ingest run immediately.
Requires: `requireRole(TenantAdmin)`

**Response**: `{ job_id, status: 'queued' }`

### GET /api/ingest/jobs
List recent ingest job history.

### GET /api/ingest/jobs/:jobId
Get status and results of a specific ingest job.

## CNCF Ingest Behavior
1. Fetch landscape.yml from configured URL
2. For each category → upsert as `capability` (source=cncf)
3. For each subcategory → upsert as child `capability`
4. For each item → upsert as `technology` with `source=cncf`
5. If technology has no card yet → create card with state=`Emerging`
6. Existing cards are NOT overwritten — tenant data is preserved
7. Write ingest job record with counts: created, updated, skipped

## Data Models

### ingest_sources
```sql
CREATE TABLE ingest_sources (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  source_type  TEXT NOT NULL,
  label        TEXT NOT NULL,
  config       TEXT NOT NULL DEFAULT '{}',
  last_run_at  INTEGER,
  is_active    INTEGER DEFAULT 1,
  created_at   INTEGER DEFAULT (strftime('%s','now'))
);
```

### ingest_jobs
```sql
CREATE TABLE ingest_jobs (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  source_id       TEXT NOT NULL REFERENCES ingest_sources(id),
  status          TEXT DEFAULT 'queued',
  -- 'queued' | 'running' | 'completed' | 'failed'
  started_at      INTEGER,
  completed_at    INTEGER,
  stats           TEXT,    -- JSON: { created, updated, skipped, errors }
  error_log       TEXT,
  triggered_by    TEXT REFERENCES users(id)
);
```
