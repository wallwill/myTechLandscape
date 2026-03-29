---
title: Technologies Spec
module: src/routes/technologies.js
---

# Technologies & Technology Cards

The Technology is the registry entry. The Technology Card is the policy document attached to it.

## Technology Endpoints

### GET /api/technologies
List all technologies for tenant.
Requires: `requireAuth`

**Query**: `?capability_id=&state=&source=&search=&page=&limit=`
**Response**: `{ total, items: Array<TechnologySummary> }`

### GET /api/technologies/:id
Get full technology + card + current metrics + active exceptions.
Requires: `requireAuth`

**Response**: `TechnologyDetail`

### POST /api/technologies
Create a new technology entry.
Requires: `requireRole(TenantAdmin, TCO)`

**Request**:
```json
{
  "tech_id": "tech-k8s-001",
  "name": "Kubernetes",
  "version_range": ">=1.28",
  "capability_id": "uuid",
  "provider": "CNCF",
  "source": "cncf",
  "homepage_url": "...",
  "description": "..."
}
```
**Error (409)**: tech_id already exists for tenant

### PUT /api/technologies/:id
Update technology metadata.
Requires: `requireRole(TenantAdmin, TCO, TO)` + ownership

### DELETE /api/technologies/:id
Soft-delete. Cannot delete if active LOB exceptions exist.
Requires: `requireRole(TenantAdmin)`

## Technology Card Endpoints

### GET /api/technologies/:id/card
Get the policy card for this technology.

**Response**: `TechnologyCard`

### PUT /api/technologies/:id/card
Update card fields (excluding lifecycle state — use /lifecycle for state changes).
Requires: `requireRole(TO, TCO)`

**Request**:
```json
{
  "usage_tier": "Mission Critical",
  "sunset_date": 1893456000,
  "adr_link": "https://confluence.uhg.com/...",
  "owner_user_id": "uuid"
}
```

## Data Models

### technology
```sql
CREATE TABLE technologies (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  tech_id        TEXT NOT NULL,            -- e.g. 'tech-k8s-001'
  name           TEXT NOT NULL,
  version_range  TEXT,
  capability_id  TEXT REFERENCES capabilities(id),
  provider       TEXT,                     -- 'CNCF', 'AWS', 'Internal'
  source         TEXT DEFAULT 'custom',    -- 'cncf' | 'custom'
  homepage_url   TEXT,
  logo           TEXT,
  description    TEXT,
  is_active      INTEGER DEFAULT 1,
  created_at     INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(tenant_id, tech_id)
);
```

### technology_card
```sql
CREATE TABLE technology_cards (
  id              TEXT PRIMARY KEY,
  technology_id   TEXT NOT NULL UNIQUE REFERENCES technologies(id),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  state           TEXT NOT NULL DEFAULT 'Emerging',
  -- Invest | Maintain | Tolerate | Eliminate | Emerging
  review_date     INTEGER,                 -- Unix timestamp
  sunset_date     INTEGER,                 -- Required for Tolerate/Eliminate
  usage_tier      TEXT,
  -- 'Mission Critical' | 'Internal Only' | 'Lab/Sandbox'
  owner_user_id   TEXT REFERENCES users(id),
  adr_link        TEXT,
  migration_target_id TEXT REFERENCES technologies(id),
  created_at      INTEGER DEFAULT (strftime('%s','now')),
  updated_at      INTEGER DEFAULT (strftime('%s','now'))
);
```

## TechnologyDetail Response Shape
```typescript
interface TechnologyDetail {
  id: string;
  tech_id: string;
  name: string;
  version_range: string | null;
  provider: string;
  capability: { id: string; name: string; path: string[] };
  card: TechnologyCard;
  metrics: CustomMetric[];
  active_exceptions: LobException[];
  patterns_summary: { approved: number; anti_patterns: number; genai: number };
  owner: { id: string; username: string; display_name: string } | null;
}
```
