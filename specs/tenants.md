---
title: Tenants Spec
module: src/routes/tenants.js
---

# Tenants

Tenants are the top-level isolation boundary. All users, technologies, metrics, decisions, and audit records are scoped to a tenant.

## Endpoints

### GET /api/tenants
List all tenants.

Requires: `platform_admin`

**Response**:
```json
[
  {
    "id": "tenant-id",
    "name": "Default",
    "slug": "default",
    "config": {},
    "is_active": 1,
    "created_at": 1710000000,
    "updated_at": 1710000000,
    "admin_count": 1
  }
]
```

Notes:
- `admin_count` counts active `tenant_admin` users only

### POST /api/tenants
Create a tenant.

Requires: `platform_admin`

**Request**:
```json
{
  "name": "Acme Bank",
  "slug": "acme-bank",
  "config": {}
}
```

**Response**: created `Tenant`

**Error (400)**: `name` or `slug` missing

**Error (409)**: slug already exists

### GET /api/tenants/admin-users
List platform and tenant admin users across all tenants.

Requires: `platform_admin`

**Response**:
```json
[
  {
    "id": "user-id",
    "tenant_id": "tenant-id",
    "username": "acme-admin",
    "email": "admin@acme.example",
    "display_name": "Acme Admin",
    "role": "tenant_admin",
    "is_active": 1,
    "created_at": 1710000000,
    "tenant_name": "Acme Bank",
    "tenant_slug": "acme-bank"
  }
]
```

### POST /api/tenants/admin-users
Create a tenant admin or platform admin user.

Requires: `platform_admin`

**Request**:
```json
{
  "tenant_id": "tenant-id",
  "username": "acme-admin",
  "password": "secret123",
  "email": "admin@acme.example",
  "display_name": "Acme Admin",
  "role": "tenant_admin"
}
```

**Allowed roles**:
- `tenant_admin`
- `platform_admin`

**Error (400)**:
- missing `tenant_id`, `username`, or `password`
- invalid role
- password shorter than 6 chars

**Error (404)**: tenant not found or inactive

**Error (409)**: username already exists in the tenant

### PUT /api/tenants/admin-users/:id
Update a tenant admin or platform admin user.

Requires: `platform_admin`

**Request**:
```json
{
  "tenant_id": "tenant-id",
  "username": "acme-admin",
  "email": "admin@acme.example",
  "display_name": "Acme Admin",
  "role": "tenant_admin",
  "password": "optional-new-password"
}
```

Notes:
- `password` is optional on update
- if provided, it must be at least 6 chars

### DELETE /api/tenants/admin-users/:id
Soft-delete an admin user by setting `is_active = 0`.

Requires: `platform_admin`

**Guard**: cannot deactivate your own account

**Response**: `{ ok: true }`

### GET /api/tenants/:tenantId
Get tenant details.

Requires: `requireTenantAccess`

### PUT /api/tenants/:tenantId
Update a tenant.

Requires: `tenant_admin` or `platform_admin`

Behavior:
- `tenant_admin` may update only their own tenant
- `platform_admin` may update any tenant
- `slug` changes are effectively platform-admin only

**Request**:
```json
{
  "name": "Acme Bank",
  "slug": "acme-bank",
  "config": {}
}
```

**Error (403)**: tenant admin attempting to update another tenant

**Error (409)**: slug already exists

### DELETE /api/tenants/:tenantId
Soft-delete a tenant by setting `is_active = 0`.

Requires: `platform_admin`

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
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  config       JSONB NOT NULL DEFAULT '{}',
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at   BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);
```

## Tenant Resolution

Tenant is resolved in this order:
1. `X-Tenant-ID` request header
2. Session `tenantSlug`
3. Subdomain-derived slug
4. Local development fallback to `default`
