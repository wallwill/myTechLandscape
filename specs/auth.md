---
title: Auth Spec
module: src/routes/auth.js
---

# Authentication

Session-based authentication using `express-session` and `bcryptjs`.

Authentication is tenant-aware. Tenant context is resolved before auth using:
1. `X-Tenant-ID` request header
2. Session `tenantSlug`
3. Subdomain-derived slug
4. Local development fallback to `default`

## Endpoints

### POST /api/auth/login
Authenticate a user inside the resolved tenant.

**Request**: `{ username: string, password: string }`

**Response (200)**:
```json
{
  "id": "user-id",
  "username": "admin",
  "role": "platform_admin",
  "tenantId": "tenant-id",
  "tenantName": "Default",
  "tenantSlug": "default"
}
```

**Error (400)**: username or password missing

**Error (401)**: invalid credentials for the resolved tenant

**Behavior**:
- Looks up the user by `username` and resolved `tenant_id`
- Requires `is_active = 1`
- Compares the provided password against `password_hash`
- On success sets session fields:
  - `userId`
  - `username`
  - `role`
  - `tenantId`
  - `tenantSlug`

### POST /api/auth/logout
Destroy the current session.

**Response (200)**: `{ ok: true }`

### GET /api/auth/me
Return the current authenticated user, or `null`.

**Response (200)**:
```json
{
  "id": "user-id",
  "username": "admin",
  "role": "platform_admin",
  "tenantId": "tenant-id",
  "tenantName": "Default",
  "tenantSlug": "default"
}
```
or `null`

### POST /api/auth/change-password
Change the authenticated user's password.

Requires: `requireAuth`

**Request**:
```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

**Response (200)**: `{ ok: true }`

**Error (400)**: missing fields or `newPassword` shorter than 6 chars

**Error (401)**: current password incorrect

## Middleware

### requireAuth(req, res, next)
Returns `401` if `req.session.userId` is not set.

### requireAdmin(req, res, next)
Legacy helper. Returns:
- `401` if unauthenticated
- `403` unless role is `admin` or `platform_admin`

## Default Seed

On startup, seed creates a default tenant and a platform admin account if missing:

- tenant slug: `default`
- username: `admin`
- password: `admin`
- role: `platform_admin`

## Frontend Login Behavior

The browser login form must provide the tenant slug. The SPA sends it via `X-Tenant-ID`.
