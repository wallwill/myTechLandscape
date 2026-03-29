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

### PUT /api/tcm/:id
Update a capability.
Requires: `requireRole(TCO, TenantAdmin)` + ownership check

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
On first ingest of CNCF data, the landscape categories and subcategories are imported as capabilities:
- Category → top-level capability
- Subcategory → child capability
- Source is marked `cncf` to distinguish from custom additions
