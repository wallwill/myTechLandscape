---
title: Teams Spec
module: src/routes/teams.js
---

# Teams

Logical groupings of users. Each team has its own set of assignments.

## Endpoints

### GET /api/teams
List all teams ordered by name.
Requires: `requireAuth`

**Response (200)**: `Array<{ id, name, created_at }>`

### POST /api/teams
Create a new team.
Requires: `requireAdmin`

**Request**: `{ name: string }`
**Response (200)**: `{ id, name, created_at }`
**Error (400)**: name missing or blank
**Error (409)**: team name already exists

### DELETE /api/teams/:id
Delete a team. Cascades to assignments (ON DELETE CASCADE).
Requires: `requireAdmin`

**Response (200)**: `{ ok: true }`

## Data Model
```sql
CREATE TABLE teams (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);
```

## Seed
Insert `Default` team on startup (`INSERT OR IGNORE`).
