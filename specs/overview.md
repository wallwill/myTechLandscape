---
title: MyTechnologyPolicy — Product Overview
version: 2.0.0
status: draft
---

# MyTechnologyPolicy

Enterprise Technology Lifecycle Management for managing technology sprawl and exposing lifecycle data for expedient decision-making by human or agent.

## Problem Statement
Enterprises face increasing technology sprawl across lines of business. Without a governed policy engine, teams independently adopt technologies, creating duplication, security risk, and unsupported dependencies. MyTechnologyPolicy provides a single authoritative source of technology lifecycle truth, accessible by humans and AI agents alike.

## Lifecycle States

| State | Intent |
|-------|--------|
| **Invest** | Actively adopt and grow usage — preferred choice for new work |
| **Maintain** | Stable — keep running, no new investment |
| **Tolerate** | Accept current usage, but plan migration — no new adoption |
| **Eliminate** | Phase out — hard sunset date required |
| **Emerging** | Under evaluation — not yet approved for production |

## Core Concepts

### Technical Capability Model (TCM)
A hierarchical taxonomy of technical capabilities (e.g., "Container Orchestration > Kubernetes"). Seeded from CNCF, extensible per tenant.

### Technology Card
The atomic unit of policy. One card per technology per tenant. Contains lifecycle state, governance metadata, agentic guidance, risk metrics, and LOB exceptions.

### Decision Record (ADR)
Every lifecycle state change requires a Decision Record linked to a Technology Owner. Immutable once created.

### Operating Model
| Role | Responsibility |
|------|---------------|
| Technical Capability Owner (TCO) | Owns a TCM capability — makes lifecycle decisions |
| Technology Owner (TO) | Owns a specific technology card — authors Decision Records |
| Technology Evaluator (TE) | Runs time-boxed or ongoing evaluations |
| LOB Admin | Manages LOB-level exceptions and tags within tenant |
| Tenant Admin | Manages users, roles, ingest sources, reporting |
| Platform Admin | Cross-tenant super-admin (internal use) |

## Architecture Modules

| Spec | Module | Description |
|------|--------|-------------|
| [tenants.md](tenants.md) | src/routes/tenants.js | Multi-tenant isolation and configuration |
| [tcm.md](tcm.md) | src/routes/tcm.js | Technical Capability Model CRUD |
| [technologies.md](technologies.md) | src/routes/technologies.js | Technology registry + card management |
| [lifecycle.md](lifecycle.md) | src/routes/lifecycle.js | State transitions and decision records |
| [operating-model.md](operating-model.md) | src/routes/operating-model.js | Users, roles, evaluators |
| [patterns.md](patterns.md) | src/routes/patterns.js | Approved patterns, anti-patterns, GenAI samples |
| [exceptions.md](exceptions.md) | src/routes/exceptions.js | LOB-level usage exceptions |
| [metrics.md](metrics.md) | src/routes/metrics.js | Custom metrics, tags, risk profiles |
| [ingest.md](ingest.md) | src/ingest/ | CNCF + custom dataset ingestion |
| [proposals.md](proposals.md) | src/routes/proposals.js | Technology proposals + feedback |
| [reporting.md](reporting.md) | src/reporting/ | Dashboards, exports, analytics |
| [audit.md](audit.md) | src/routes/audit.js | Immutable audit trail (AI governance) |
| [mcp-server.md](mcp-server.md) | src/mcp/server.js | MCP server for agentic interoperability |

## Folder Structure
```
myTechnologyPolicy/
├── specs/                    # Behavioral specifications
├── src/
│   ├── db/                   # Schema, migrations, seed
│   ├── middleware/           # Auth, tenant isolation, RBAC
│   ├── routes/               # REST API (one file per spec)
│   ├── mcp/                  # MCP server for agentic access
│   ├── ingest/               # Data ingestion pipelines
│   └── reporting/            # Report generators
├── public/                   # Frontend SPA
├── data/                     # Per-tenant SQLite (or multi-DB)
└── server.js                 # Entry point
```

## Multi-Tenancy Model
- Each tenant is fully isolated: separate data, roles, configurations
- Tenant identified via subdomain or API header `X-Tenant-ID`
- Platform Admins can access all tenants for support purposes
- MCP Server is tenant-aware — tools scoped to authenticated tenant
