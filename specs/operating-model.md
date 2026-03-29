---
title: Operating Model Spec
module: src/routes/operating-model.js
---

# Operating Model

Defines tenant-scoped users and baseline role assignments within a tenant.

This route manages general tenant users. Platform-level tenant creation and tenant-admin creation are handled by [tenants.md](tenants.md).

## Roles

| Role | Scope | Key Permissions |
|------|-------|----------------|
| `platform_admin` | Cross-tenant | Create tenants, manage tenant admins, cross-tenant support |
| `tenant_admin` | Tenant | Manage tenant users and tenant config |
| `tco` | Capability | Own capabilities, approve lifecycle transitions |
| `technology_owner` | Technology | Manage technology card details and patterns |
| `lob_admin` | LOB within tenant | Manage LOB exceptions and tags |
| `evaluator` | Tenant | Run and document evaluations |
| `proposer` | Tenant | Submit proposals |
| `member` | Tenant | Baseline tenant user role |

Implemented with related governance extensions:
- tenant admins can create tenant users with `display_name`
- tenant admins can update tenant-scoped roles and deactivate users
- capability owner and evaluator pool assignment is defined in [governance-workflow.md](governance-workflow.md)

## Endpoints

### GET /api/users
List users in the current tenant.

Requires: `tenant_admin`

**Response**:
```json
[
  {
    "id": "user-id",
    "username": "jdoe",
    "email": "jdoe@example.com",
    "display_name": "Jane Doe",
    "role": "member",
    "lob": null,
    "is_active": 1,
    "created_at": 1710000000
  }
]
```

### POST /api/users
Create a tenant-scoped user.

Requires: `tenant_admin`

**Request**:
```json
{
  "username": "jdoe",
  "email": "jdoe@example.com",
  "display_name": "Jane Doe",
  "password": "secret123",
  "role": "member",
  "capability_id": "optional-capability-id",
  "lob": "optional-lob"
}
```

Notes:
- `password` is required and must be at least 6 chars
- `display_name` is optional
- `capability_id` is used only when creating a `tco`
- `tenant_id` is inferred from resolved tenant context

### PUT /api/users/:id/role
Update a tenant user's role.

Requires: `tenant_admin`

**Request**:
```json
{
  "role": "technology_owner"
}
```

**Response**:
```json
{ "ok": true }
```

### DELETE /api/users/:id
Soft-delete a tenant user by setting `is_active = 0`.

Requires: `tenant_admin`

**Guard**: cannot delete your own account

**Response**:
```json
{ "ok": true }
```

### GET /api/users/:id/assignments
Return a user's capability ownership and technology-card ownership within the current tenant.

Requires: `requireTenantAccess`

**Response**:
```json
{
  "capabilities": [
    {
      "id": "capability-id",
      "name": "Platform Engineering"
    }
  ],
  "technology_cards": [
    {
      "name": "Kubernetes",
      "tech_id": "kubernetes",
      "state": "Invest"
    }
  ]
}
```

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
  lob            TEXT,
  is_active      INTEGER DEFAULT 1,
  created_at     BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  UNIQUE(tenant_id, username)
);
```

### capability_ownership
```sql
CREATE TABLE capability_ownership (
  capability_id TEXT NOT NULL REFERENCES capabilities(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  tenant_id     TEXT NOT NULL,
  assigned_at   BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  PRIMARY KEY (capability_id, user_id)
);
```
