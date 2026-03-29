---
title: Teams Spec
status: legacy
---

# Teams

This document is legacy and does not describe the current implementation.

The current application model is tenant-based, not team-based:
- tenant CRUD and tenant-admin CRUD are defined in [tenants.md](tenants.md)
- tenant user CRUD is defined in [operating-model.md](operating-model.md)
- authentication is tenant-aware and defined in [auth.md](auth.md)

Historical references to `/api/teams` and a `Default` team should be treated as obsolete.
