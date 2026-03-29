---
title: Governance Workflow Spec
status: proposed
---

# Governance Workflow

This spec defines the target tenant-level operating model for technology governance: capability owners, technology evaluators, assignment queues, and new technology requests.

## Objectives

- Give each tenant a configurable governance operating model
- Route new technology demand into explicit capability queues
- Make ownership, evaluation, and decision points auditable
- Turn approved requests into managed technology records and cards

## Actor Model

| Actor | Scope | Core Responsibilities |
|------|-------|-----------------------|
| `platform_admin` | Cross-tenant | Create tenants, create tenant admins, support tenant setup |
| `tenant_admin` | Tenant | Configure roles, capabilities, queues, workflow rules, and user assignments |
| `capability_owner` | Capability | Own decision-making for one or more capabilities |
| `technology_evaluator` | Tenant or capability | Perform assessments and record findings |
| `technology_owner` | Technology | Own approved technology cards and lifecycle maintenance |
| `requestor` | Tenant | Submit new technology requests and track progress |
| `governance_reviewer` | Optional | Provide additional approval or risk review |

Notes:
- In the current codebase, `capability_owner` maps most closely to `tco`
- `technology_evaluator` can be represented initially by the existing `evaluator` role
- `tenant_admin` must be able to configure assignments for all of these roles

## Primary Use Cases

### UC-1 Configure Tenant Operating Model
Primary actor: `tenant_admin`

Main flow:
1. Tenant admin creates or imports capability taxonomy.
2. Tenant admin assigns one or more capability owners.
3. Tenant admin assigns evaluator users to capability queues.
4. Tenant admin configures workflow settings such as required evidence, SLA targets, and approval policy.
5. System stores assignments and writes audit events.

Outputs:
- capability records
- role assignment records
- tenant workflow configuration

### UC-2 Submit New Technology Request
Primary actor: `requestor`

Main flow:
1. User enters technology name, business problem, requested capability, justification, evidence, and priority.
2. System validates required fields.
3. System creates a request in `submitted` status.
4. System creates a queue item in `new` or `needs_triage`.
5. System writes audit events.

Alternate flows:
- duplicate detected: system flags a possible existing technology
- capability unknown: request enters `needs_triage`

### UC-3 Triage Request Into Capability Queue
Primary actor: `tenant_admin` or `capability_owner`

Main flow:
1. Actor reviews incoming requests.
2. Actor assigns or corrects capability mapping.
3. Actor sets priority, due date, and owner.
4. Actor assigns an evaluator or leaves it unassigned.
5. System moves request to `triaged` or `assigned`.

### UC-4 Run Technology Evaluation
Primary actor: `technology_evaluator`

Main flow:
1. Evaluator receives assigned queue item.
2. Evaluator records scope, fit, risks, architecture impact, operational concerns, and evidence.
3. Evaluator sets a recommendation such as `approve`, `reject`, `pilot`, or `needs_more_info`.
4. System stores evaluation and updates queue state to `awaiting_decision`.

### UC-5 Make Capability-Level Decision
Primary actor: `capability_owner`

Main flow:
1. Capability owner reviews the request and evaluation.
2. Capability owner records a decision and rationale.
3. System updates request and queue statuses.
4. System writes a decision record and audit event.
5. If approved, system offers to create a technology record and technology card.

### UC-6 Create Managed Technology From Approved Request
Primary actor: system, initiated by `capability_owner` or `tenant_admin`

Main flow:
1. System creates `technology`.
2. System creates `technology_card`.
3. System assigns capability and optional technology owner.
4. Initial lifecycle state is set, usually `Emerging`.
5. System links the technology back to the originating request.

### UC-7 Manage Assignment Queues
Primary actor: `tenant_admin`, `capability_owner`

Main flow:
1. Actor views queue dashboards by capability, evaluator, status, and age.
2. Actor reassigns items when needed.
3. Actor escalates overdue items.
4. System produces SLA and aging metrics.

### UC-8 Reassess Existing Technology
Primary actor: `tenant_admin`, `capability_owner`, `technology_owner`

Triggers:
- security event
- vendor change
- duplication signal
- lifecycle review date reached
- request to change state

Outputs:
- new queue item
- evaluation
- decision update

## MVP Backlog

1. Tenant admin creates capability taxonomy
2. Tenant admin assigns capability owners
3. Tenant admin creates evaluator accounts and assignments
4. Requestor submits new technology request
5. Tenant admin triages request into a capability queue
6. Capability owner assigns evaluator
7. Evaluator records findings and recommendation
8. Capability owner approves, rejects, defers, or requests more information
9. Approved request creates technology and technology card
10. Tenant admin or capability owner assigns technology owner
11. Tenant admin views queue status, aging, and workload
12. Tenant admin updates user role assignments
13. Capability owner triggers reassessment of an existing technology
14. System audits every assignment, decision, and role change
15. Tenant admin configures workflow rules and defaults

## MVP User Stories

- As a tenant admin, I can create and edit capabilities so work is organized by domain.
- As a tenant admin, I can assign capability owners so each capability has accountable decision makers.
- As a tenant admin, I can create evaluator accounts and assign them to capabilities so reviews can be delegated.
- As a requestor, I can submit a new technology request with business justification so it enters governance.
- As a tenant admin, I can triage requests into capability queues so they reach the correct owners.
- As a capability owner, I can assign evaluators so requests are assessed by the right people.
- As an evaluator, I can record findings, risk notes, and recommendation so decisions are evidence-based.
- As a capability owner, I can approve or reject requests so tenant technology policy is explicit.
- As a capability owner, I can request more information so weak or incomplete proposals do not advance.
- As the system, I can create a technology card from an approved request so approved technologies enter lifecycle management.
- As a tenant admin, I can assign a technology owner so approved technologies have an accountable maintainer.
- As a tenant admin, I can configure workflow defaults so tenant governance is consistent.
- As a tenant admin, I can see queue aging and bottlenecks so I can improve throughput.
- As a capability owner, I can trigger reassessment of an existing technology so policy remains current.
- As an auditor, I can review changes to roles, assignments, requests, and decisions so governance is traceable.

## Exact Schema Changes

### `technology_requests`
```sql
CREATE TABLE technology_requests (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL REFERENCES tenants(id),
  requester_id      TEXT NOT NULL REFERENCES users(id),
  capability_id     TEXT REFERENCES capabilities(id),
  technology_id     TEXT REFERENCES technologies(id),
  request_type      TEXT NOT NULL,
  title             TEXT NOT NULL,
  technology_name   TEXT,
  summary           TEXT NOT NULL,
  business_case     TEXT,
  desired_outcome   TEXT,
  justification     TEXT NOT NULL,
  risk_summary      TEXT,
  priority          TEXT DEFAULT 'medium',
  status            TEXT NOT NULL DEFAULT 'submitted',
  evidence_links    TEXT,
  source_links      TEXT,
  duplicate_of_request_id TEXT REFERENCES technology_requests(id),
  created_at        BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at        BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);
```

### `request_queue_items`
```sql
CREATE TABLE request_queue_items (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL REFERENCES tenants(id),
  request_id            TEXT NOT NULL UNIQUE REFERENCES technology_requests(id),
  capability_id         TEXT REFERENCES capabilities(id),
  assigned_owner_id     TEXT REFERENCES users(id),
  assigned_evaluator_id TEXT REFERENCES users(id),
  queue_state           TEXT NOT NULL DEFAULT 'new',
  priority              TEXT DEFAULT 'medium',
  due_date              BIGINT,
  triaged_at            BIGINT,
  assigned_at           BIGINT,
  decision_due_at       BIGINT,
  completed_at          BIGINT,
  created_at            BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at            BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);
```

### `capability_evaluators`
```sql
CREATE TABLE capability_evaluators (
  capability_id  TEXT NOT NULL REFERENCES capabilities(id),
  user_id        TEXT NOT NULL REFERENCES users(id),
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  assigned_at    BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  PRIMARY KEY (capability_id, user_id)
);
```

### `technology_request_comments`
```sql
CREATE TABLE technology_request_comments (
  id           TEXT PRIMARY KEY,
  request_id   TEXT NOT NULL REFERENCES technology_requests(id),
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  author_id    TEXT NOT NULL REFERENCES users(id),
  comment_type TEXT DEFAULT 'comment',
  comment      TEXT NOT NULL,
  created_at   BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);
```

### `technology_request_artifacts`
```sql
CREATE TABLE technology_request_artifacts (
  id            TEXT PRIMARY KEY,
  request_id    TEXT NOT NULL REFERENCES technology_requests(id),
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  label         TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  url           TEXT,
  content       TEXT,
  created_by    TEXT REFERENCES users(id),
  created_at    BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);
```

### Expand `evaluations`
```sql
ALTER TABLE evaluations ADD COLUMN request_id TEXT REFERENCES technology_requests(id);
ALTER TABLE evaluations ADD COLUMN capability_id TEXT REFERENCES capabilities(id);
ALTER TABLE evaluations ADD COLUMN evaluation_type TEXT DEFAULT 'technology_request';
ALTER TABLE evaluations ADD COLUMN score_summary TEXT;
```

## API Surface

### Tenant Operating Model
- `GET /api/capability-owners`
- `POST /api/capability-owners`
- `DELETE /api/capability-owners/:capabilityId/:userId`
- `GET /api/capability-evaluators`
- `POST /api/capability-evaluators`
- `DELETE /api/capability-evaluators/:capabilityId/:userId`

### Technology Requests
- `GET /api/technology-requests`
- `POST /api/technology-requests`
- `GET /api/technology-requests/:id`
- `PUT /api/technology-requests/:id`
- `POST /api/technology-requests/:id/comments`
- `POST /api/technology-requests/:id/artifacts`

### Queue Management
- `GET /api/request-queue`
- `PUT /api/request-queue/:id/triage`
- `PUT /api/request-queue/:id/assign`
- `PUT /api/request-queue/:id/state`

### Evaluation Workflow
- `POST /api/technology-requests/:id/evaluations`
- `PUT /api/evaluations/:id`
- `POST /api/evaluations/:id/submit`

### Decision Workflow
- `POST /api/technology-requests/:id/decision`
- `POST /api/technology-requests/:id/implement`

## Recommended Status Model

### Request Status
- `draft`
- `submitted`
- `needs_triage`
- `triaged`
- `assigned`
- `evaluating`
- `awaiting_decision`
- `approved`
- `rejected`
- `deferred`
- `implemented`

### Queue State
- `new`
- `triaged`
- `assigned`
- `in_evaluation`
- `awaiting_decision`
- `blocked`
- `completed`
- `cancelled`

## Audit Requirements

Write audit events for:
- request creation
- request triage
- owner assignment
- evaluator assignment
- queue state changes
- evaluation submission
- decision creation
- role assignment changes
- technology creation from request

