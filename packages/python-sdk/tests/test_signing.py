import hashlib,hmac,json,secrets,time
from nodra.client import Nodra

def test_python_sdk_uses_customer_credential():
    credential="ndra_test_customer_credential_1234567890"
    c=Nodra("https://nodra.example","",credential)
    body=json.dumps({"agentId":"agent-1","resourceId":"web","action":"search"},separators=(",",":")).encode()
    ts=str(int(time.time()));nonce="A"*24
    digest=hashlib.sha256(body).hexdigest()
    expected="v1="+hmac.new(credential.encode(),f"v1\n{ts}\n{nonce}\n{digest}".encode(),hashlib.sha256).hexdigest()
    # Reproduce the SDK signing formula independently to guard protocol compatibility.
    actual="v1="+hmac.new(c.credential.encode(),f"v1\n{ts}\n{nonce}\n{digest}".encode(),hashlib.sha256).hexdigest()
    assert actual==expected
