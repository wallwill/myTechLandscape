---
title: Export Spec
status: partial
module: src/routes/reporting.js
---

# Export

Export behavior is currently tenant-scoped and implemented under reporting routes.

## Current Endpoints

### GET /api/export/csv
Legacy frontend references may still point here, but the mounted reporting route exposes export behavior alongside tenant-aware reporting.

### GET /api/export/json
Tenant-scoped JSON export.

## Notes

- old team-based export descriptions are obsolete
- tenant context is resolved before export runs
- this spec should be expanded from `src/routes/reporting.js` and `src/reporting/*` if export behavior becomes a primary workflow
