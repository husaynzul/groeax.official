---
name: API Server Workflow Fix
description: The artifact-managed workflow for api-server fails port detection even though the server starts fine. Fix and context.
---

## The Problem

The artifact-managed workflow `artifacts/api-server: API Server` (command: `pnpm --filter @workspace/api-server run dev`) consistently fails with `DIDNT_OPEN_A_PORT` even though the server starts successfully and logs "Server listening port: 8080". The `getWorkflowStatus` returns `openPorts: null` despite the port being genuinely open and the proxy routing correctly.

**Why:** The Replit workflow cgroup-based port monitor cannot attribute port 8080 to the pnpm/node process tree for this artifact. Root cause not fully known — may be a platform issue with `kind = "api"` artifacts in dev mode.

## The Fix

Create a **custom standalone workflow** (not the artifact-managed one) with **no `waitForPort`** so liveness tracking is process-based, not port-based:

```javascript
await configureWorkflow({
    name: "API Server",
    command: "PORT=8080 NODE_ENV=development node --enable-source-maps /home/runner/workspace/artifacts/api-server/dist/index.mjs",
    outputType: "console",
    autoStart: true
    // No waitForPort
});
```

**Why this works:** Without `waitForPort`, the workflow tracks process liveness only. The server stays RUNNING as long as node is alive. The proxy routes `/api` → port 8080 based on `artifact.toml` and does NOT check workflow status for routing.

## How to Apply

1. Run `node ./build.mjs` first to ensure `dist/index.mjs` is fresh
2. Call `configureWorkflow` as above
3. Verify: `curl localhost:80/api/healthz` → `{"status":"ok"}`

## Artifact Workflow State

The artifact.toml dev run currently uses:
```toml
[services.development]
run = "node --enable-source-maps /home/runner/workspace/artifacts/api-server/dist/index.mjs"
[services.env]
PORT = "8080"
NODE_ENV = "development"
```

The `artifacts/api-server: API Server` workflow will always show FAILED — this is expected and harmless. The real server runs under the `API Server` custom workflow.
