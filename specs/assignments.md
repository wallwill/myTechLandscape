---
title: Assignments Spec
module: src/routes/assignments.js
---

# Assignments

Records which lifecycle stage a team has assigned to each CNCF project.

## Endpoints

### GET /api/assignments
Get all assignments for a team.
Requires: `requireAuth`

**Query**: `?team_id=<id>` (defaults to session's teamId)
**Response (200)**: `Array<Assignment>`
Returns empty array if no teamId is resolved.

### POST /api/assignments
Create, update, or remove an assignment. Also writes an audit log entry.
Requires: `requireAuth`

**Request**:
```json
{
  "projectId": "string (required)",
  "projectName": "string (optional, for audit label)",
  "stage": "Invest|Maintain|Tolerate|Eliminate|\"\" (empty = remove)",
  "owner": "string (optional)",
  "notes": "string (optional)",
  "teamId": "number (optional, defaults to session teamId)"
}
```

**Behavior**:
- If `stage` is empty/absent: delete existing assignment + log `remove` action
- If `stage` is set: upsert assignment + log `assign` or `update` action

**Response (200)**: `{ ok: true }`
**Error (400)**: projectId or teamId missing

## Data Model
```sql
CREATE TABLE assignments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  team_id    INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  stage      TEXT NOT NULL,
  owner      TEXT,
  notes      TEXT,
  updated_at INTEGER DEFAULT (strftime('%s','now')),
  updated_by INTEGER REFERENCES users(id),
  UNIQUE(project_id, team_id)
);
```

## Lifecycle Stages
`Invest` | `Maintain` | `Tolerate` | `Eliminate`
