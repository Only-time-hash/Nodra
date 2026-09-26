# Nodra Python quickstart

## 1. Install

```bash
pip install nodra-agent-sdk
```

## 2. Configure

```bash
export NODRA_BASE_URL=https://your-nodra.example
export NODRA_CREDENTIAL=...
```

## 3. Protect an agent

```python
import os
from nodra import Nodra, NodraError

nodra = Nodra(
    os.environ["NODRA_BASE_URL"],
    os.environ["NODRA_CREDENTIAL"],
)

finance = nodra.protect("finance-agent")

try:
    decision = finance.authorize_and_wait(
        "stripe",
        "payments.submit",
        context={
            "amount": 5000,
            "environment": "production",
            "metadata": {"currency": "USD"},
        },
        timeout_seconds=300,
    )
except NodraError as error:
    print(error.code)
    raise

if decision["decision"] != "allow":
    raise RuntimeError("Nodra did not allow the payment")

submit_payment()

finance.record(
    resource_id="stripe",
    action="payments.submit",
    decision="allow",
    phase="result",
    executed=True,
    outcome="submitted",
)
```

## Security rules

- Keep credentials server-side.
- Fail closed when Nodra cannot authorize a consequential action.
- Use `authorize_and_wait` only when automatic human-approval continuation is desired.
- Never bypass containment by calling protected external tools directly.
