---
title: Auth Spec
module: src/routes/auth.js
---

# Authentication

Session-based auth using express-session and bcryptjs password hashing.

## Endpoints

### POST /api/auth/login
Authenticate a user by username and password.

**Request**: `{ username: string, password: string }`
**Response (200)**: `{ id, username, role, teamId }`
**Error (400)**: username or password missing
**Error (401)**: invalid credentials

**Behavior**:
- Looks up user by username in DB
- Compares provided password with bcrypt hash
- On success: sets session fields `userId`, `username`, `role`, `teamId`

### POST /api/auth/logout
Destroy the current session.

**Response (200)**: `{ ok: true }`

### GET /api/auth/me
Return the currently authenticated user, or null if unauthenticated.

**Response (200)**: `{ id, username, role, teamId }` or `null`

### POST /api/auth/change-password
Change the authenticated user's password.
Requires: active session (`requireAuth`)

**Request**: `{ currentPassword: string, newPassword: string }`
**Response (200)**: `{ ok: true }`
**Error (400)**: missing fields or newPassword < 6 chars
**Error (401)**: currentPassword incorrect

## Middleware

### requireAuth(req, res, next)
Returns 401 if `req.session.userId` is not set.

### requireAdmin(req, res, next)
Returns 401 if not authenticated, 403 if role is not `admin`.

## Default Seed
If no admin user exists at startup, create one:
- username: `admin`
- password: `admin`
- role: `admin`
- team: Default team
