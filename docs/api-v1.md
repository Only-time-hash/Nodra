# Nodra Public API v1

Nodra v1 is the stable runtime-facing API for external AI-agent integrations.

Base path:

```text
/api/v1
```

## Stability

Within v1, Nodra will not intentionally remove documented fields, change field meaning, or reinterpret a documented error code without a deprecation period.

Additive response fields may be introduced at any time. Clients should ignore unknown response fields.

The legacy `/api/gateway/*` routes remain internal compatibility routes. New integrations should use v1.

## Authentication

Runtime requests use a Nodra integration credential and HMAC signature.

Required headers:

```text
content-type: application/json
x-nodra-credential: ndra_...
x-nodra-timestamp: <unix-seconds>
x-nodra-nonce: <unique nonce>
x-nodra-signature: v1=<hex-hmac>
```

SDKs generate these automatically.

Every v1 response includes:

```text
x-nodra-api-version: v1
x-nodra-request-id: <traceable request id>
```

The request ID should be included in support logs and incident reports.

## POST /api/v1/authorize

Evaluate whether an agent may perform a consequential action.

Request:

```json
{
  "agentId": "finance-agent",
  "resourceId": "stripe",
  "action": "payments.submit"
}
```

Response:

```json
{
  "decision": "allow",
  "reason": "authority_scope_allows",
  "agentId": "finance-agent",
  "resourceId": "stripe",
  "action": "payments.submit",
  "authorizationEventId": "..."
}
```

`decision` is one of:

- `allow`
- `deny`
- `require-approval`

A caller MUST NOT execute the protected action after `deny` or `require-approval`.

## POST /api/v1/events

Record runtime intent/result evidence.

Request fields:

- `id`: caller-generated event identifier.
- `agentId`
- `resourceId`
- `action`
- `decision`
- `phase`: `intent` or `result`
- `executed`
- optional `outcome`, `reason`, `causedBy`, `causedByEventId`, `incidentId`, `occurredAt`

## POST /api/v1/approval-status

Check whether a specific `require-approval` authorization is still pending, approved, or denied.

Request:

```json
{
  "agentId": "finance-agent",
  "resourceId": "stripe",
  "action": "payments.submit",
  "authorizationEventId": "..."
}
```

Response:

```json
{
  "status": "approved",
  "reason": "Reviewed by finance operations",
  "decidedAt": "2026-09-26T10:00:00Z"
}
```

The SDK polls this endpoint only for the exact agent/action/resource/event tuple that originally required approval.

## POST /api/v1/approval-claim

After approval, the runtime generates a random one-time execution token locally and submits it to Nodra. Nodra stores only the token hash.

Request:

```json
{
  "agentId": "finance-agent",
  "resourceId": "stripe",
  "action": "payments.submit",
  "authorizationEventId": "...",
  "executionToken": "<runtime-generated-one-time-token>"
}
```

The claim operation is idempotent for the same token hash. This allows a runtime to retry after an ambiguous network failure without requiring a reviewer to copy a token manually.

## POST /api/v1/execute-approved

Consume a one-time human-approval execution token.

Request:

```json
{
  "agentId": "finance-agent",
  "resourceId": "stripe",
  "action": "payments.submit",
  "authorizationEventId": "...",
  "executionToken": "..."
}
```

Successful response:

```json
{
  "decision": "allow",
  "reason": "human_approval_consumed",
  "authorizationEventId": "...",
  "executionEventId": "...",
  "agentId": "finance-agent",
  "resourceId": "stripe",
  "action": "payments.submit"
}
```

Approval tokens are one-time and expire. Clients MUST NOT automatically retry approved execution after an ambiguous network failure.

## GET /api/v1/health

Returns the public API version and gateway status.

## Error contract

Error responses use:

```json
{
  "error": "machine_readable_code"
}
```

Important stable codes include:

| Code | Meaning |
| --- | --- |
| `credential_missing` | Credential header is absent. |
| `invalid_credential` | Credential does not map to an active registered agent. |
| `credential_too_short` | SDK-side credential validation failed. |
| `gateway_request_replayed` | A nonce was reused. |
| `workspace_api_access_disabled` | Workspace API access is disabled. |
| `agent_not_healthy` | Agent is paused/quarantined or otherwise unavailable. |
| `approval_authorization_mismatch` | Approval does not match the original action. |
| `approval_pending` | Human review has not completed yet. |
| `approval_denied` | Human reviewer denied the action. |
| `approval_token_already_claimed` | Another execution token was already bound to the approval. |
| `approval_wait_timeout` | SDK stopped waiting before a reviewer decided. |
| `approval_token_invalid_expired_or_consumed` | Approval token cannot be consumed. |
| `gateway_event_rate_limit_exceeded` | Event ingestion budget exceeded. |
| `request_timeout` | SDK timed out before a definitive response. |
| `network_error` | SDK could not reach Nodra. |

Unknown 5xx errors should be treated as fail-closed for consequential actions.

## Deprecation policy

When a v1 field or behavior eventually needs replacement:

1. a replacement will be documented first;
2. existing behavior will remain available during a migration window;
3. SDK releases will support the replacement before removal;
4. breaking contract changes will move to a new major API version.
