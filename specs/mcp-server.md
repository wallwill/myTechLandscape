---
title: MCP Server Spec
module: src/mcp/server.js
---

# MCP Server — Agentic Interoperability

A Model Context Protocol (MCP) server exposing technology lifecycle data to AI agents. Tenant-aware via `X-Tenant-ID` header or session token.

## Authentication
MCP requests must include:
- `Authorization: Bearer <api_token>` (tenant-scoped service token)
- `X-Tenant-ID: <tenant_slug>`

Service tokens are managed via `GET/POST /api/tokens`.

## MCP Tools

### `get_technology_card`
Returns the full policy card for a technology.

**Input**:
```json
{
  "tech_id": "string",           // e.g. 'tech-k8s-001' or 'kubernetes'
  "include_patterns": true,
  "include_metrics": true,
  "lob": "string"                // optional — applies LOB exception overlay
}
```

**Output**:
```json
{
  "tech_id": "tech-k8s-001",
  "name": "Kubernetes",
  "state": "Invest",
  "usage_tier": "Mission Critical",
  "sunset_date": null,
  "review_date": "2026-01-15",
  "owner": "platform-team@uhg.com",
  "adr_link": "https://...",
  "lob_override": null,
  "patterns": [...],
  "anti_patterns": [...],
  "genai_prompts": [...],
  "sdk_constraints": [...],
  "metrics": { "security_score": "Gold", "license_type": "Apache-2.0" }
}
```

### `list_technologies`
List technologies matching criteria.

**Input**:
```json
{
  "state": "Invest",             // optional filter
  "capability": "Container Orchestration",
  "lob": "Platform Engineering",
  "include_emerging": false
}
```

### `get_approved_patterns`
Get approved patterns and anti-patterns for a technology.

**Input**: `{ "tech_id": "string", "type": "approved_pattern|anti_pattern|genai_prompt|sdk_constraint" }`

### `check_lob_exception`
Check if a specific LOB has an exception for a technology.

**Input**: `{ "tech_id": "string", "lob": "string" }`
**Output**: `{ "has_exception": true, "type": "approved|prohibited|restricted", "conditions": "..." }`

### `get_decision_record`
Get the Decision Record (ADR) for the most recent state transition.

**Input**: `{ "tech_id": "string" }`
**Output**: `DecisionRecord`

### `submit_proposal`
Submit a technology proposal on behalf of an agent action.

**Input**:
```json
{
  "technology_name": "string",
  "justification": "string",
  "capability": "string",
  "proposed_state": "Emerging",
  "evidence_links": ["string"]
}
```

### `get_lifecycle_summary`
Get a concise lifecycle summary for one or more technologies.

**Input**: `{ "tech_ids": ["string"] }`
**Output**: Map of tech_id → `{ state, review_date, sunset_date, active_exceptions }`

## MCP Server Configuration
```javascript
// src/mcp/server.js
const server = new McpServer({
  name: 'MyTechnologyPolicy',
  version: '2.0.0',
  tools: [
    getTechnologyCard,
    listTechnologies,
    getApprovedPatterns,
    checkLobException,
    getDecisionRecord,
    submitProposal,
    getLifecycleSummary,
  ]
});
```

## Tenant Isolation
All MCP tools resolve the tenant from the service token before any database query. A token cannot access data outside its tenant. Platform Admin tokens can specify `X-Tenant-ID` to switch context.
