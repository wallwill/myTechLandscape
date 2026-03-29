---
title: Governance Workflow Implementation Plan
status: proposed
---

# Governance Workflow Implementation Plan

This plan converts the governance workflow into an implementable phased roadmap for this repository.

## Phase 1: Tenant Operating Model Foundation

Goal:
- Give tenant admins enough control to configure governance roles and capability ownership

Status:
- implemented: capability owner assignment APIs
- implemented: evaluator assignment APIs
- implemented: tenant admin UI for tenant users and category assignments
- implemented: audit entries for capability assignment changes
- remaining: broader workflow settings beyond assignment foundation

Deliverables:
- capability owner assignment APIs
- evaluator assignment APIs
- tenant admin screens for role assignment
- audit entries for operating-model changes

Repository impact:
- `src/db/schema.js`
- `src/routes/operating-model.js`
- new routes for capability owner and evaluator assignment
- admin SPA updates in `public/`

Exit criteria:
- tenant admin can assign capability owners and evaluators
- assignments are persisted and auditable

## Phase 2: Technology Request Intake

Goal:
- Introduce a first-class intake workflow for new technology demand

Deliverables:
- `technology_requests` table
- request submission API
- request details API
- request comments and artifacts
- request submission UI

Exit criteria:
- requestor can submit and track a request
- tenant admin can view all requests

## Phase 3: Queue and Triage Workflow

Goal:
- Make incoming work assignable and visible

Deliverables:
- `request_queue_items` table
- queue list API
- triage API
- assignment API for owner and evaluator
- queue dashboard UI

Exit criteria:
- tenant admin can triage requests into capability queues
- capability owners can see their assigned queue

## Phase 4: Evaluation Workflow

Goal:
- Allow evaluators to produce structured evidence and recommendations

Deliverables:
- extend `evaluations` for request-linked evaluations
- evaluation create/update/submit endpoints
- evaluator workbench UI
- evidence capture and recommendation fields

Exit criteria:
- evaluator can complete a request evaluation
- queue item transitions to `awaiting_decision`

## Phase 5: Decision and Implementation Workflow

Goal:
- Turn completed evaluations into auditable decisions and approved portfolio entries

Deliverables:
- decision endpoint for requests
- implementation endpoint to create `technology` and `technology_card`
- linkage from request to technology
- audit logging for decision and creation

Exit criteria:
- capability owner can approve or reject requests
- approved requests create managed technology records

## Phase 6: Reporting and SLA Management

Goal:
- Give tenant admins and capability owners operational visibility

Deliverables:
- queue aging metrics
- workload by evaluator and capability owner
- approval and rejection trends
- overdue item reporting
- reassessment triggers and alerts

Exit criteria:
- tenant admin can see governance throughput and bottlenecks

## Recommended Delivery Order

1. role assignment foundation
2. request intake
3. queue and triage
4. evaluation
5. decision and implementation
6. reporting

## Non-Goals For Early MVP

- complex approval chains
- multi-board voting
- external ticketing integration
- notifications beyond basic audit and UI status
- full custom workflow designer

## Migration Notes

- current `proposals` can be retained temporarily as a transitional intake mechanism
- request intake should eventually subsume proposal-style new technology flow
- current tenant admin UI should evolve from tenant CRUD toward tenant-local governance configuration
