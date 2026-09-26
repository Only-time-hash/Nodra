# Nodra Python SDK

Protect consequential Python AI-agent actions with Nodra's deterministic authorization gateway.

## Install

```bash
pip install nodra-agent-sdk
```

The distribution name is `nodra-agent-sdk`; the Python import is `nodra`.

## Quick start

```python
import os
from nodra import Nodra

nodra = Nodra(
    base_url=os.environ["NODRA_BASE_URL"],
    credential=os.environ["NODRA_CREDENTIAL"],
    timeout_seconds=8,
    max_retries=2,
)

finance = nodra.protect("finance-agent")

decision = finance.authorize(
    resource_id="stripe",
    action="payments.submit",
)

if decision["decision"] == "allow":
    submit_payment()

if decision["decision"] == "require-approval":
    print("Waiting for human approval:", decision["authorizationEventId"])
```

## Record evidence

```python
finance.intent(
    "stripe",
    "payments.submit",
    decision="allow",
)

result = submit_payment()

finance.result(
    "stripe",
    "payments.submit",
    decision="allow",
    executed=True,
    outcome="succeeded",
)
```

## Execute a human-approved action

When a reviewer approves a `require-approval` request, the runtime uses the one-time execution token:

```python
finance.execute_approved(
    resource_id="stripe",
    action="payments.submit",
    authorization_event_id=authorization_event_id,
    execution_token=execution_token,
)
```

Approved execution is deliberately not automatically retried because the token is one-time.

## Error handling

```python
from nodra import NodraError

try:
    finance.authorize("stripe", "payments.submit")
except NodraError as error:
    print(error.code, error.status, error.request_id, error.retryable)
```

## Security

- Keep `NODRA_CREDENTIAL` in server-side secret storage.
- Never embed it in browser/mobile code.
- Every request is HMAC signed with a timestamp and nonce.
- Safe authorization/event requests use bounded retries.
- One-time approved execution never retries automatically.
- Nodra remains fail-closed when the gateway cannot authorize an action.
