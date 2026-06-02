---
name: Admin JWT auth — approve endpoint header
description: Admin approve-payment endpoint must receive JWT as Authorization Bearer header, not as adminToken body param
---

The admin panel stores a JWT in localStorage as `groeax_admin_token`. All fetch calls to admin endpoints must include `Authorization: Bearer <jwt>` in headers.

**Why:** `verifyAdminJwt(req)` reads `req.headers.authorization`. Sending the JWT as `adminToken` in the body only works if the value matches the raw ADMIN_API_TOKEN secret string, which a JWT never does.

**How to apply:** All admin fetch calls must include `{ Authorization: \`Bearer \${token}\` }` in headers. The backend `requireAdmin()` function checks JWT first, then falls back to raw body token for legacy compat.
