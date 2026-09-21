import hashlib
import hmac
import json
import unittest
from unittest.mock import patch

from nodra.client import Nodra


class _Response:
    status = 200
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def read(self):
        return b'{"decision":"allow","reason":"test"}'


class SigningTests(unittest.TestCase):
    def test_python_sdk_sends_credential_and_valid_hmac(self):
        credential = "ndra_test_customer_credential_1234567890"
        client = Nodra("https://nodra.example", "", credential)
        captured = {}

        def fake_urlopen(request, timeout=None):
            captured["request"] = request
            return _Response()

        with patch("urllib.request.urlopen", fake_urlopen):
            client.authorize("agent-1", "web", "search")

        request = captured["request"]
        body = request.data
        headers = {k.lower(): v for k, v in request.header_items()}
        self.assertEqual(headers["x-nodra-credential"], credential)
        timestamp = headers["x-nodra-timestamp"]
        nonce = headers["x-nodra-nonce"]
        digest = hashlib.sha256(body).hexdigest()
        canonical = f"v1\n{timestamp}\n{nonce}\n{digest}".encode()
        expected = "v1=" + hmac.new(credential.encode(), canonical, hashlib.sha256).hexdigest()
        self.assertTrue(hmac.compare_digest(headers["x-nodra-signature"], expected))

    def test_rejects_short_customer_credential(self):
        with self.assertRaises(ValueError):
            Nodra("https://nodra.example", "", "short")


if __name__ == "__main__":
    unittest.main()
