# Nodra Python SDK

Server-side SDK for connecting Python AI-agent applications to Nodra.

```python
from nodra import Nodra
nodra=Nodra(base_url=NODRA_URL,workspace_id=NODRA_WORKSPACE_ID,signing_secret=NODRA_GATEWAY_SIGNING_SECRET)
agent=nodra.protect("research")
decision=agent.authorize("web","search")
if decision["decision"]=="allow":
    # execute protected operation
    pass
```

Never embed the signing secret in browser or mobile code.
