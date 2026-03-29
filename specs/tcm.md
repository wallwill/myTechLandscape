---
title: Technical Capability Model (TCM) Spec
module: src/routes/tcm.js
---

# Technical Capability Model

Hierarchical taxonomy of technical capabilities. Seeded from CNCF landscape categories. Fully extensible per tenant.

Governance linkage:
- capabilities are the routing layer for request queues
- capability owners are assigned through tenant operating-model configuration
- evaluator pools can also be assigned per capability

## Endpoints

### GET /api/tcm
List capabilities for current tenant. Returns tree structure.
Requires: `requireAuth`

**Query**: `?flat=true` returns array instead of tree
**Response**: `Array<Capability>` (nested or flat)

Behavior:
- before responding, the route ensures top-level CNCF landscape categories exist for the tenant
- only top-level categories are auto-seeded by the current implementation

### POST /api/tcm/sync-categories
Ensure top-level CNCF categories exist for the current tenant and return the current active capability set.

Requires: `tenant_admin`

**Response**:
```json
{
  "ok": true,
  "items": []
}
```

### POST /api/tcm
Create a new capability.
Requires: `requireRole(TCO, TenantAdmin)`

**Request**:
```json
{
  "name": "Container Orchestration",
  "description": "...",
  "parent_id": "uuid-or-null",
  "owner_user_id": "uuid"
}
```

**Response**: `Capability`

Behavior:
- if `owner_user_id` is provided, the route also creates a matching row in `capability_ownership`

### PUT /api/tcm/:id
Update a capability.
Requires: `requireRole(TCO, TenantAdmin)` + ownership check

Behavior:
- if `owner_user_id` is provided, the route ensures a matching `capability_ownership` row exists

### DELETE /api/tcm/:id
Soft-delete a capability. Cannot delete if active technology cards exist.
Requires: `requireRole(TenantAdmin)`

**Error (409)**: capability has active technologies

### GET /api/tcm/:id/technologies
List all technologies mapped to this capability.

## Data Model
```sql
CREATE TABLE capabilities (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  name         TEXT NOT NULL,
  description  TEXT,
  parent_id    TEXT REFERENCES capabilities(id),
  owner_user_id TEXT REFERENCES users(id),
  source       TEXT DEFAULT 'custom',   -- 'cncf' | 'custom'
  is_active    INTEGER DEFAULT 1,
  created_at   INTEGER DEFAULT (strftime('%s','now')),
  updated_at   INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(tenant_id, name, parent_id)
);
```

## CNCF Seeding
Current implementation:
- top-level CNCF landscape categories are auto-created when `/api/tcm` is read
- tenant admins can trigger the same sync explicitly with `POST /api/tcm/sync-categories`
- seeded rows use `source = 'cncf'`

Not yet implemented:
- automatic subcategory import
- ongoing reconciliation of renamed or removed landscape categories
