---
title: Patterns Spec
module: src/routes/patterns.js
---

# Patterns & Agentic Guidance

Approved patterns, anti-patterns, and GenAI samples attached to a Technology Card. Designed for MCP consumption to guide code generation by AI agents.

## Pattern Types
| Type | Description |
|------|-------------|
| `approved_pattern` | Reference architecture or approved usage pattern |
| `anti_pattern` | Practices to avoid — agent MUST surface when relevant |
| `genai_prompt` | Pre-vetted system prompt for generating code for this tech |
| `sdk_constraint` | Specific library versions, forks, or exclusions authorised |
| `code_sample` | Approved code snippet (linked or inline) |

## Endpoints

### GET /api/technologies/:id/patterns
List all patterns for a technology card.
Requires: `requireAuth`

**Query**: `?type=approved_pattern|anti_pattern|genai_prompt|sdk_constraint|code_sample`
**Response**: `Array<Pattern>`

### POST /api/technologies/:id/patterns
Add a pattern.
Requires: `requireRole(TO, TCO)`

**Request**:
```json
{
  "type": "approved_pattern",
  "title": "Helm-based Deployment",
  "content": "All Kubernetes workloads MUST be deployed via Helm charts. Direct kubectl apply is prohibited in production.",
  "code_sample": "helm install my-app ./charts/my-app -f values.prod.yaml",
  "language": "bash",
  "tags": ["deployment", "helm"],
  "source_url": "https://confluence.internal/helm-standards"
}
```

### PUT /api/technologies/:id/patterns/:patternId
Update pattern content.
Requires: `requireRole(TO, TCO)`

### DELETE /api/technologies/:id/patterns/:patternId
Remove pattern.
Requires: `requireRole(TO, TCO)`

## Data Model
```sql
CREATE TABLE patterns (
  id             TEXT PRIMARY KEY,
  technology_id  TEXT NOT NULL REFERENCES technologies(id),
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  type           TEXT NOT NULL,
  title          TEXT NOT NULL,
  content        TEXT NOT NULL,
  code_sample    TEXT,
  language       TEXT,
  tags           TEXT,           -- JSON array
  source_url     TEXT,
  created_by     TEXT REFERENCES users(id),
  created_at     INTEGER DEFAULT (strftime('%s','now')),
  updated_at     INTEGER DEFAULT (strftime('%s','now'))
);
```

## MCP Consumption
Patterns are the primary output of the `get_agentic_guidance` MCP tool. Anti-patterns are returned with higher prominence and MUST be surfaced in agent responses when the technology is referenced.
