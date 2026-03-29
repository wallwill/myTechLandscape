---
title: Users Spec
module: src/routes/users.js
---

# Users

App accounts with roles. All write operations are admin-only.

## Endpoints

### GET /api/users
List all users with their team name.
Requires: `requireAdmin`

**Response (200)**: `Array<{ id, username, role, team_id, team_name, created_at }>`

### POST /api/users
Create a new user.
Requires: `requireAdmin`

**Request**: `{ username: string, password: string, role?: string, teamId?: number }`
**Response (200)**: `{ id, username, role, team_id }`
**Error (400)**: username/password missing, or password < 6 chars
**Error (409)**: username already exists

### DELETE /api/users/:id
Delete a user.
Requires: `requireAdmin`

**Response (200)**: `{ ok: true }`
**Error (400)**: cannot delete your own account

## Data Model
```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  team_id       INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  role          TEXT NOT NULL DEFAULT 'member',
  created_at    INTEGER DEFAULT (strftime('%s','now'))
);
```

## Roles
| Role | Permissions |
|------|-------------|
| `member` | View and manage own team's assignments |
| `admin` | All member permissions + manage teams/users |
