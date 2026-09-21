# Pre-execution authorization

Sensitive agent tools should call Nodra before execution. The caller sends a signed POST to /api/gateway/authorize with agentId, resourceId and action.

Nodra fails closed for unhealthy agents. Explicit authority scope can allow an action. Requests outside explicit authority return require-approval.

The integration must execute a protected tool only after an allow decision. require-approval is not permission to execute.

This endpoint is the first enforcement contract. Policy composition, approval objects, credential lifecycle and enterprise adapters will extend it without changing the fail-closed rule.
