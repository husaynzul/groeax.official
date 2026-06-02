---
name: API Server workflow restart
description: The artifact-managed API server workflow consistently fails port detection on restart; the custom "API Server" workflow is reliable
---

The workflow `artifacts/api-server: API Server` reliably fails `restart_workflow` with DIDNT_OPEN_A_PORT even though the server starts fine (confirmed with direct bash run).

**Why:** The artifact workflow command lacks `PORT=8080` inline — it relies on `[services.env]` from artifact.toml, which doesn't seem to propagate reliably during agent-initiated restarts.

**How to apply:** Always restart via the custom `API Server` workflow (command: `PORT=8080 NODE_ENV=development node --enable-source-maps /home/runner/workspace/artifacts/api-server/dist/index.mjs`). After rebuilding with `node ./build.mjs`, call `restart_workflow("API Server")` not the artifact-managed one.
