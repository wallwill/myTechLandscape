---
title: Audit Spec
module: src/routes/audit.js
---

# Audit Trail

Immutable log of all state changes across all entities. Required for AI governance compliance and regulatory audit.

## What is Audited
- Technology card state transitions
- Decision record creation
- User role changes
- LOB exception creation/revocation
- Pattern add/edit/delete
- Ingest runs
- Tenant configuration changes
- Proposal status changes

## Endpoints

### GET /api/audit
Query audit log for current tenant.
Requires: `requireRole(TenantAdmin, TCO)` or own records for members

**Query**:
```
?entity_type=technology_card|decision_record|user|lob_exception|pattern|proposal
&entity_id=uuid
&user_id=uuid
&action=create|update|delete|transition
&from=unix_ts
&to=unix_ts
&page=1
&limit=50
```

**Response**: `{ total, items: Array<AuditEntry> }`

### GET /api/audit/entity/:entityType/:entityId
Get full audit history for a specific entity.

## Data Model
```sql
CREATE TABLE audit_log (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  action        TEXT NOT NULL,    -- 'create' | 'update' | 'delete' | 'transition'
  user_id       TEXT,
  username      TEXT,
  old_value     TEXT,             -- JSON snapshot
  new_value     TEXT,             -- JSON snapshot
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    INTEGER DEFAULT (strftime('%s','now'))
);

CREATE INDEX idx_audit_tenant_entity ON audit_log(tenant_id, entity_type, entity_id);
CREATE INDEX idx_audit_tenant_time   ON audit_log(tenant_id, created_at DESC);
```

## Audit Middleware
All write operations (POST/PUT/DELETE) automatically write an audit entry via `src/middleware/audit.js`. Route handlers call `auditLog(req, entityType, entityId, action, oldValue, newValue)`.
