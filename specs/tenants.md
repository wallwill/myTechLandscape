---
title: Tenants Spec
module: src/routes/tenants.js
---

# Tenants

Top-level isolation unit. All data — technologies, cards, users, audit — is scoped to a tenant.

## Endpoints

### GET /api/tenants (Platform Admin only)
List all tenants.

**Response**: `Array<Tenant>`

### POST /api/tenants (Platform Admin only)
Create a new tenant.

**Request**: `{ name, slug, config? }`
**Response**: `Tenant`
**Error (409)**: slug already exists

### GET /api/tenants/:tenantId
Get tenant details.
Requires: `requireTenantAccess`

**Response**: `Tenant`

### PUT /api/tenants/:tenantId (Tenant Admin)
Update tenant configuration.

**Request**: `{ name?, config? }`
**Response**: `Tenant`

### DELETE /api/tenants/:tenantId (Platform Admin)
Soft-delete a tenant.

**Response**: `{ ok: true }`

## Tenant Configuration Object
```json
{
  "default_review_cadence_days": 365,
  "require_adr_for_state_change": true,
  "allow_lob_exceptions": true,
  "mcp_enabled": true,
  "ingest_sources": ["cncf"],
  "custom_lifecycle_states": []
}
```

## Data Model
```sql
CREATE TABLE tenants (
  id           TEXT PRIMARY KEY,           -- UUID
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,       -- e.g. 'uhg', 'elevance'
  config       TEXT NOT NULL DEFAULT '{}', -- JSON
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER DEFAULT (strftime('%s','now')),
  updated_at   INTEGER DEFAULT (strftime('%s','now'))
);
```

## Tenant Resolution
Tenant is resolved from:
1. `X-Tenant-ID` request header (API / MCP)
2. Subdomain: `uhg.mytechpolicy.com` → slug=`uhg`
3. Session (for browser users)
