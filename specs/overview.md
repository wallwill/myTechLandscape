---
title: MyTechnologyPolicy - Product Overview
version: 2.1.0
status: draft
---

# MyTechnologyPolicy

Enterprise technology lifecycle management for controlling technology sprawl and exposing lifecycle data for human and agent workflows.

## Problem Statement

Enterprises face increasing technology sprawl across lines of business. Without a governed policy engine, adoption becomes fragmented, operational risk grows, and decision history disappears. MyTechnologyPolicy provides a tenant-aware source of truth for lifecycle state, governance metadata, and auditability.

## Lifecycle States

| State | Intent |
|-------|--------|
| **Invest** | Preferred for new adoption |
| **Maintain** | Keep running, limited new investment |
| **Tolerate** | Allowed temporarily, migration should be planned |
| **Eliminate** | Phase out and sunset |
| **Emerging** | Under evaluation, not yet broadly approved |

## Core Concepts

### Tenant
Top-level isolation unit. Every user, technology, decision, metric, and audit record belongs to exactly one tenant.

### Tenant Slug
Stable machine-friendly tenant identifier, for example `default` or `acme-bank`. Used for request routing via `X-Tenant-ID`, session, or subdomain.

### Technical Capability Model
Hierarchical taxonomy of capabilities. Used to group technologies and assign capability ownership.

### Technology Card
Primary policy object for a technology inside a tenant. Holds lifecycle state and governance metadata.

### Decision Record
Immutable record of a lifecycle state transition and its rationale.

## Operating Model

| Role | Responsibility |
|------|----------------|
| Platform Admin | Cross-tenant administration, tenant creation, tenant-admin management |
| Tenant Admin | Tenant-scoped administration and user management |
| TCO | Capability ownership and lifecycle governance |
| Technology Owner | Technology-specific ownership |
| Evaluator | Evaluation execution |
| LOB Admin | LOB exception management |
| Proposer | Proposal submission |
| Member | Baseline tenant user |

## Current MVP Direction

- Login is tenant-aware and requires tenant context
- Platform admins create tenants and tenant admin users
- Tenant admins manage users inside their tenant
- The admin SPA now supports tenant-local user management and category owner/evaluator assignment
- Governance foundation is implemented for capability ownership and evaluator pools
- The next major workflow is request intake, queueing, evaluations, and decisions

## Architecture Modules

| Spec | Module | Description |
|------|--------|-------------|
| [tenants.md](tenants.md) | src/routes/tenants.js | Tenant CRUD and tenant-admin management |
| [auth.md](auth.md) | src/routes/auth.js | Tenant-aware session authentication |
| [operating-model.md](operating-model.md) | src/routes/operating-model.js | Tenant user CRUD and role assignment |
| [governance-workflow.md](governance-workflow.md) | src/routes/governance.js | Implemented capability owner and evaluator assignment foundation, plus planned request workflow |
| [implementation-plan.md](implementation-plan.md) | specs/implementation-plan.md | Phased rollout plan for governance workflow |
| [tcm.md](tcm.md) | src/routes/tcm.js | Technical Capability Model CRUD |
| [technologies.md](technologies.md) | src/routes/technologies.js | Technology registry and cards |
| [lifecycle.md](lifecycle.md) | src/routes/lifecycle.js | State transitions and decision records |
| [patterns.md](patterns.md) | src/routes/patterns.js | Patterns and anti-patterns |
| [exceptions.md](exceptions.md) | src/routes/exceptions.js | Tenant-scoped exceptions |
| [metrics.md](metrics.md) | src/routes/metrics.js | Custom metrics and tags |
| [ingest.md](ingest.md) | src/ingest/ | CNCF and custom ingestion |
| [proposals.md](proposals.md) | src/routes/proposals.js | Proposal workflow |
| [reporting.md](reporting.md) | src/reporting/ | Reporting and exports |
| [audit.md](audit.md) | src/routes/audit.js | Audit trail |
| [mcp-server.md](mcp-server.md) | src/mcp/server.js | Tenant-aware MCP server |

## Multi-Tenancy Model

- Tenant identified by `X-Tenant-ID`, session `tenantSlug`, or subdomain
- Local development falls back to tenant slug `default`
- Platform admins can manage tenant definitions and tenant admin users
- Browser login must supply tenant context
