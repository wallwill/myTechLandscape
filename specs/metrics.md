---
title: Metrics & Tags Spec
module: src/routes/metrics.js
---

# Custom Metrics & Tags

Tenant-configurable metrics and free-form tags that extend Technology Cards.

## Built-in Metrics (seeded per tenant)
| Key | Type | Description |
|-----|------|-------------|
| `security_score` | `enum` | Gold / Silver / Bronze / Unrated |
| `license_type` | `enum` | Apache-2.0 / MIT / GPL / Proprietary / Other |
| `operational_readiness` | `number` | 1–5 rating of internal support capability |
| `cost_profile` | `enum` | Low (OSS) / Medium / High |
| `cve_count_active` | `number` | Count of unresolved CVEs |

## Endpoints

### GET /api/metrics/definitions
List all metric definitions for current tenant.
Requires: `requireAuth`

### POST /api/metrics/definitions
Create a custom metric definition.
Requires: `requireRole(TenantAdmin)`

**Request**:
```json
{
  "key": "fips_compliant",
  "label": "FIPS Compliant",
  "type": "boolean",
  "required": false,
  "description": "Whether this technology meets FIPS 140-2 requirements"
}
```

### GET /api/technologies/:id/metrics
Get all metric values for a technology.

### PUT /api/technologies/:id/metrics
Set metric values.
Requires: `requireRole(TO, TCO, TenantAdmin)`

**Request**: `{ metrics: { [key]: value } }`

### GET /api/technologies/:id/tags
Get tags for a technology.

### POST /api/technologies/:id/tags
Add a tag.

**Request**: `{ tag: string, value?: string }`

### DELETE /api/technologies/:id/tags/:tag
Remove a tag.

## Data Models

### metric_definitions
```sql
CREATE TABLE metric_definitions (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  key          TEXT NOT NULL,
  label        TEXT NOT NULL,
  type         TEXT NOT NULL,   -- 'string' | 'number' | 'boolean' | 'enum'
  enum_values  TEXT,            -- JSON array for type=enum
  required     INTEGER DEFAULT 0,
  description  TEXT,
  is_builtin   INTEGER DEFAULT 0,
  UNIQUE(tenant_id, key)
);
```

### technology_metrics
```sql
CREATE TABLE technology_metrics (
  id             TEXT PRIMARY KEY,
  technology_id  TEXT NOT NULL REFERENCES technologies(id),
  tenant_id      TEXT NOT NULL,
  metric_key     TEXT NOT NULL,
  metric_value   TEXT,          -- stored as text, cast on read
  updated_by     TEXT REFERENCES users(id),
  updated_at     INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(technology_id, metric_key)
);
```

### technology_tags
```sql
CREATE TABLE technology_tags (
  id             TEXT PRIMARY KEY,
  technology_id  TEXT NOT NULL REFERENCES technologies(id),
  tenant_id      TEXT NOT NULL,
  tag            TEXT NOT NULL,
  value          TEXT,
  created_by     TEXT REFERENCES users(id),
  created_at     INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(technology_id, tag)
);
```
