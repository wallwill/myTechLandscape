---
title: Landscape Spec
module: src/routes/landscape.js
---

# CNCF Landscape

Fetches and caches CNCF project data from GitHub.

## Endpoints

### GET /api/landscape
Return all CNCF projects. Serves from local cache if fresh.
Requires: `requireAuth`

**Response (200)**: `Array<Project>`
**Error (500)**: fetch or parse failure

## Caching
- Cache file: `data/landscape_cache.json`
- TTL: 24 hours
- Format: `{ fetchedAt: number (ms), data: Project[] }`
- Source: `https://raw.githubusercontent.com/cncf/landscape/master/landscape.yml`

## Project Shape
```typescript
interface Project {
  id: string;          // name lowercased, non-alphanumeric replaced with _
  name: string;
  category: string;
  subcategory: string;
  homepage_url: string | null;
  logo: string | null;
  description: string | null;
  project: "graduated" | "incubating" | "sandbox" | null;
}
```

## Parsing
Traverse `landscape.yml`:
```
landscape[]
  .subcategories[]
    .items[]  → Project
```
