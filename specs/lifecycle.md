---
title: Lifecycle & Decision Records Spec
module: src/routes/lifecycle.js
---

# Lifecycle Management

State transitions are the core governance action. Every transition creates an immutable Decision Record.

## Lifecycle States
```
Emerging ──► Invest ──► Maintain ──► Tolerate ──► Eliminate
         ◄──────────────────────────────────────
         (any state can transition to any state with a Decision Record)
```

## Endpoints

### POST /api/technologies/:id/lifecycle/transition
Transition a technology card to a new state.
Requires: `requireRole(TCO, TO)` + ownership

**Request**:
```json
{
  "new_state": "Tolerate",
  "rationale": "Superseded by Argo Workflows — plan migration by Q4 2026",
  "sunset_date": 1767225600,
  "review_date": 1735689600,
  "migration_target_id": "uuid-of-argo",
  "adr_link": "https://...",
  "evidence_links": ["https://..."]
}
```

**Validation**:
- `Tolerate` or `Eliminate` → `sunset_date` required
- If tenant config `require_adr_for_state_change: true` → `adr_link` required
- Cannot transition if an active Evaluation is blocking

**Response**: `{ card: TechnologyCard, decision_record: DecisionRecord }`

### GET /api/technologies/:id/lifecycle/history
Full state transition history for a technology card.

**Response**: `Array<DecisionRecord>`

### GET /api/technologies/:id/lifecycle/evaluations
List evaluations for this technology.

### POST /api/technologies/:id/lifecycle/evaluations
Start a new evaluation.
Requires: `requireRole(TCO, TenantAdmin)`

**Request**:
```json
{
  "evaluator_user_id": "uuid",
  "scope": "Security review for PCI-DSS compliance",
  "start_date": 1735689600,
  "end_date": 1751328000,
  "blocking": false
}
```

### PUT /api/technologies/:id/lifecycle/evaluations/:evalId
Update evaluation findings or complete it.
Requires: evaluator ownership

**Request**:
```json
{
  "status": "completed",
  "findings": "Passed all security benchmarks. CIS Kubernetes Benchmark Level 2.",
  "recommendation": "Invest",
  "evidence_links": ["https://..."]
}
```

## Data Models

### decision_records
```sql
CREATE TABLE decision_records (
  id               TEXT PRIMARY KEY,
  technology_id    TEXT NOT NULL REFERENCES technologies(id),
  tenant_id        TEXT NOT NULL REFERENCES tenants(id),
  state_before     TEXT,
  state_after      TEXT NOT NULL,
  rationale        TEXT NOT NULL,
  adr_link         TEXT,
  evidence_links   TEXT,               -- JSON array
  sunset_date      TEXT,
  review_date      TEXT,
  decision_maker_id TEXT NOT NULL REFERENCES users(id),
  created_at       INTEGER DEFAULT (strftime('%s','now'))
  -- Immutable after creation
);
```

### evaluations
```sql
CREATE TABLE evaluations (
  id               TEXT PRIMARY KEY,
  technology_id    TEXT NOT NULL REFERENCES technologies(id),
  tenant_id        TEXT NOT NULL REFERENCES tenants(id),
  evaluator_id     TEXT NOT NULL REFERENCES users(id),
  scope            TEXT,
  start_date       INTEGER,
  end_date         INTEGER,            -- null = indefinite
  status           TEXT DEFAULT 'active',
  -- 'active' | 'completed' | 'cancelled'
  findings         TEXT,
  recommendation   TEXT,
  evidence_links   TEXT,               -- JSON array
  blocking         INTEGER DEFAULT 0,
  created_at       INTEGER DEFAULT (strftime('%s','now')),
  updated_at       INTEGER DEFAULT (strftime('%s','now'))
);
```
