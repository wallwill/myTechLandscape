---
title: LOB Exceptions Spec
module: src/routes/exceptions.js
---

# LOB Usage Exceptions

Allow Lines of Business (LOBs) to override the tenant-level lifecycle decision for specific use cases.

## Exception Types
| Type | Description |
|------|-------------|
| `approved` | LOB is approved to use tech even if tenant state is Tolerate/Eliminate |
| `prohibited` | LOB is prohibited from using tech even if tenant state is Invest |
| `restricted` | LOB may use tech only under specified conditions |

## Endpoints

### GET /api/technologies/:id/exceptions
List all LOB exceptions for this technology.
Requires: `requireAuth`

**Response**: `Array<LobException>`

### POST /api/technologies/:id/exceptions
Create a LOB exception.
Requires: `requireRole(TCO, TenantAdmin, LobAdmin)`

**Request**:
```json
{
  "lob": "Global Banking",
  "exception_type": "prohibited",
  "justification": "PCI-DSS scope — only approved container runtimes permitted",
  "conditions": "N/A",
  "expires_at": 1767225600,
  "migration_target_id": "uuid"
}
```

**Response**: `LobException`

### PUT /api/technologies/:id/exceptions/:exceptionId
Update exception (extend expiry, change type).
Requires: `requireRole(TCO, TenantAdmin, LobAdmin)` + LOB ownership

### DELETE /api/technologies/:id/exceptions/:exceptionId
Revoke exception.
Requires: `requireRole(TCO, TenantAdmin)`

### GET /api/lob/:lob/exceptions
Get all active exceptions for a LOB.
Requires: `requireRole(LobAdmin, TenantAdmin)`

## Data Model
```sql
CREATE TABLE lob_exceptions (
  id                  TEXT PRIMARY KEY,
  technology_id       TEXT NOT NULL REFERENCES technologies(id),
  tenant_id           TEXT NOT NULL REFERENCES tenants(id),
  lob                 TEXT NOT NULL,
  exception_type      TEXT NOT NULL,   -- 'approved' | 'prohibited' | 'restricted'
  justification       TEXT NOT NULL,
  conditions          TEXT,
  expires_at          INTEGER,         -- null = permanent
  migration_target_id TEXT REFERENCES technologies(id),
  approved_by         TEXT REFERENCES users(id),
  is_active           INTEGER DEFAULT 1,
  created_at          INTEGER DEFAULT (strftime('%s','now')),
  updated_at          INTEGER DEFAULT (strftime('%s','now'))
);
```
