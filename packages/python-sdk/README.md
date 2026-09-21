# Nodra Python SDK

Server-side SDK for connecting Python AI-agent applications to Nodra.

```python
import os
from nodra import Nodra

nodra = Nodra(
    base_url=os.environ["NODRA_BASE_URL"],
    workspace_id=os.environ.get("NODRA_WORKSPACE_ID", ""),
    credential=os.environ["NODRA_CREDENTIAL"],
)
agent = nodra.protect(os.environ["NODRA_AGENT_ID"])
decision = agent.authorize("web", "search")
if decision["decision"] == "allow":
    # execute the protected operation
    pass
```

The SDK uses the per-agent `NODRA_CREDENTIAL` and signed timestamp/nonce requests. Keep the credential only in server-side secret storage.

Never embed `NODRA_CREDENTIAL` in browser/mobile code, source control, logs, or client bundles.
