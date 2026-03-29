---
title: Reporting Spec
module: src/reporting/
---

# Reporting & Analytics

Tenant-scoped dashboards, exports, and analytics for technology portfolio health.

## Endpoints

### GET /api/reporting/dashboard
Return summary statistics for tenant dashboard.
Requires: `requireAuth`

**Response**:
```json
{
  "total_technologies": 847,
  "by_state": {
    "Invest": 120,
    "Maintain": 310,
    "Tolerate": 220,
    "Eliminate": 80,
    "Emerging": 117
  },
  "by_capability": [...],
  "overdue_reviews": 34,
  "expiring_exceptions": 12,
  "active_evaluations": 7,
  "pending_proposals": 5,
  "recent_decisions": [...]
}
```

Planned additions for governance workflow:
- `queue_items_new`
- `queue_items_overdue`
- `requests_awaiting_decision`
- `avg_days_to_decision`
- `evaluations_in_progress`
- `requests_by_capability`
- `requests_by_evaluator`
- `requests_by_decision_outcome`

### GET /api/reporting/sunset-calendar
Technologies with sunset dates, sorted ascending.
Requires: `requireAuth`

**Query**: `?days_ahead=90`
**Response**: `Array<{ technology, card, days_until_sunset }>`

### GET /api/reporting/review-due
Technologies whose review_date is past or within threshold.
Requires: `requireAuth`

**Query**: `?days_overdue=0` (0 = include all past-due)

### GET /api/reporting/coverage
Percentage of technologies with complete cards.
Requires: `requireAuth`

**Response**: Coverage breakdown by field completeness.

### GET /api/export/csv
Export full portfolio as CSV.
Requires: `requireAuth`

**Query**: `?state=&capability_id=&include_metrics=true&include_exceptions=true`

### GET /api/export/json
Export full portfolio as JSON (for agent consumption).

## Report Modules
- `src/reporting/dashboard.js` — aggregate statistics
- `src/reporting/exports.js` — CSV and JSON export logic
- `src/reporting/sunset.js` — sunset and review-due calculations
