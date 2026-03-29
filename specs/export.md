---
title: Export Spec
module: src/routes/export.js
---

# Export

Provides data export for a team's current assignments.

## Endpoints

### GET /api/export/csv
Download all CNCF projects merged with the team's assignments as a CSV file.
Requires: `requireAuth`

**Query**: `?team_id=<id>` (defaults to session's teamId)
**Response**: `text/csv` attachment, filename `cncf-landscape-assignments.csv`

## CSV Schema
```
Name, Category, Subcategory, CNCF Status, Stage, Owner, Notes, Last Updated, Updated By
```

**Behavior**:
- Fetches full landscape (uses cache)
- Joins with team's assignments by `project_id`
- All fields are double-quote escaped
- `Last Updated` is ISO 8601 UTC when assignment exists, empty otherwise
