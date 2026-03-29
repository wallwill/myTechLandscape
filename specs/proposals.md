---
title: Proposals Spec
module: src/routes/proposals.js
---

# Technology Proposals

Allow any tenant member to propose adding or updating a technology. TCOs/Technology Owners review and provide feedback.

## Proposal Types
| Type | Description |
|------|-------------|
| `new_technology` | Propose adding a technology not in the registry |
| `state_change` | Request a lifecycle state change for existing technology |
| `retire` | Propose eliminating a technology |

## Endpoints

### GET /api/proposals
List proposals for current tenant.
Requires: `requireAuth`

**Query**: `?status=pending|under_review|approved|rejected&type=`
**Response**: `Array<Proposal>`

### POST /api/proposals
Submit a proposal.
Requires: `requireAuth` (any member)

**Request**:
```json
{
  "type": "new_technology",
  "technology_name": "Cilium",
  "capability_id": "uuid-of-networking",
  "proposed_state": "Invest",
  "justification": "CNI with eBPF provides better observability than Flannel. Used in production at Stripe, Datadog.",
  "evidence_links": ["https://cilium.io/blog/...", "https://..."],
  "requestor_lob": "Platform Engineering"
}
```

**Response**: `Proposal`
**Side effect**: Notifies TCO for the capability (if assigned)

### GET /api/proposals/:id
Get proposal details including feedback history.

### POST /api/proposals/:id/feedback
Add reviewer feedback.
Requires: `requireRole(TCO, TO, TenantAdmin)`

**Request**:
```json
{
  "status": "under_review",
  "comment": "Good use case — scheduling eval for Q2. @evaluator-user has been assigned.",
  "evaluator_user_id": "uuid"
}
```

### PUT /api/proposals/:id/decision
Approve or reject a proposal.
Requires: `requireRole(TCO, TenantAdmin)`

**Request**:
```json
{
  "decision": "approved",
  "decision_notes": "Approved for Lab/Sandbox. Full Invest pending security review.",
  "create_card": true,
  "initial_state": "Emerging"
}
```

## Data Model
```sql
CREATE TABLE proposals (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL REFERENCES tenants(id),
  type              TEXT NOT NULL,
  technology_id     TEXT REFERENCES technologies(id),
  technology_name   TEXT,
  capability_id     TEXT REFERENCES capabilities(id),
  proposed_state    TEXT,
  justification     TEXT NOT NULL,
  evidence_links    TEXT,              -- JSON array
  requestor_id      TEXT NOT NULL REFERENCES users(id),
  requestor_lob     TEXT,
  status            TEXT DEFAULT 'pending',
  -- 'pending' | 'under_review' | 'approved' | 'rejected'
  reviewer_id       TEXT REFERENCES users(id),
  decision_notes    TEXT,
  decided_at        INTEGER,
  created_at        INTEGER DEFAULT (strftime('%s','now')),
  updated_at        INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE proposal_feedback (
  id           TEXT PRIMARY KEY,
  proposal_id  TEXT NOT NULL REFERENCES proposals(id),
  author_id    TEXT NOT NULL REFERENCES users(id),
  comment      TEXT NOT NULL,
  status_set   TEXT,
  created_at   INTEGER DEFAULT (strftime('%s','now'))
);
```
