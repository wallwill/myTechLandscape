---
title: Operating Model Spec
module: src/routes/operating-model.js
---

# Operating Model

Defines users, roles, and role assignments within a tenant.

## Roles

| Role | Scope | Key Permissions |
|------|-------|----------------|
| `platform_admin` | Cross-tenant | Create tenants, impersonate, view all data |
| `tenant_admin` | Tenant | Manage users/roles, configure tenant, all data access |
| `tco` | Capability | Own capabilities, approve state transitions, assign evaluators |
| `technology_owner` | Technology | Author decision records, update cards, manage patterns |
| `evaluator` | Technology (time-boxed) | Submit evaluation findings |
| `lob_admin` | LOB within tenant | Manage LOB exceptions, LOB-specific tags |
| `member` | Tenant | Read-only access to cards and decisions |
| `proposer` | Tenant | Submit technology proposals |

## Endpoints

### GET /api/users
List users in current tenant.
Requires: `requireRole(tenant_admin)`

**Response**: `Array<UserSummary>`

### POST /api/users
Invite a user to the tenant.
Requires: `requireRole(tenant_admin)`

**Request**: `{ username, email, role, capability_id? (for tco), lob? (for lob_admin) }`

### PUT /api/users/:id/role
Change a user's role.
Requires: `requireRole(tenant_admin)`

### DELETE /api/users/:id
Remove user from tenant.
Requires: `requireRole(tenant_admin)`
**Guard**: Cannot remove yourself.

### GET /api/users/:id/assignments
Get all technology/capability assignments for a user.

## Data Model

### users
```sql
CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  username       TEXT NOT NULL,
  email          TEXT,
  display_name   TEXT,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'member',
  lob            TEXT,                -- for lob_admin scope
  is_active      INTEGER DEFAULT 1,
  created_at     INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(tenant_id, username)
);
```

### capability_ownership
```sql
CREATE TABLE capability_ownership (
  capability_id  TEXT NOT NULL REFERENCES capabilities(id),
  user_id        TEXT NOT NULL REFERENCES users(id),
  tenant_id      TEXT NOT NULL,
  assigned_at    INTEGER DEFAULT (strftime('%s','now')),
  PRIMARY KEY (capability_id, user_id)
);
```
