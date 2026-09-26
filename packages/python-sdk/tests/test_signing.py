import hashlib
import hmac
import json
import unittest
import urllib.error
from unittest.mock import patch

from nodra import Nodra, NodraError


class _Headers(dict):
    def get(self, key, default=None):
        return super().get(key.lower(), default)


class _Response:
    status = 200

    def __init__(self, payload=None):
        self.payload = payload or {"decision": "allow", "reason": "test"}

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return json.dumps(self.payload).encode()


class SigningTests(unittest.TestCase):
    def test_python_sdk_sends_credential_and_valid_hmac(self):
        credential = "ndra_test_customer_credential_1234567890"
        client = Nodra("https://nodra.example", credential)
        captured = {}

        def fake_urlopen(request, timeout=None):
            captured["request"] = request
            captured["timeout"] = timeout
            return _Response()

        with patch("urllib.request.urlopen", fake_urlopen):
            client.authorize("agent-1", "web", "search")

        request = captured["request"]
        body = request.data
        headers = {k.lower(): v for k, v in request.header_items()}

        self.assertEqual(headers["x-nodra-credential"], credential)
        self.assertEqual(headers["x-nodra-sdk-version"], "0.1.0")
        self.assertEqual(captured["timeout"], 8.0)

        timestamp = headers["x-nodra-timestamp"]
        nonce = headers["x-nodra-nonce"]
        digest = hashlib.sha256(body).hexdigest()
        canonical = f"v1\n{timestamp}\n{nonce}\n{digest}".encode()
        expected = "v1=" + hmac.new(
            credential.encode(),
            canonical,
            hashlib.sha256,
        ).hexdigest()

        self.assertTrue(
            hmac.compare_digest(headers["x-nodra-signature"], expected)
        )

    def test_rejects_short_customer_credential(self):
        with self.assertRaises(NodraError) as captured:
            Nodra("https://nodra.example", "short")

        self.assertEqual(captured.exception.code, "credential_too_short")

    def test_execute_approved_uses_one_time_endpoint_without_retry(self):
        credential = "ndra_test_customer_credential_1234567890"
        client = Nodra(
            "https://nodra.example",
            credential,
            max_retries=3,
        )
        calls = []

        def fake_urlopen(request, timeout=None):
            calls.append(request.full_url)
            return _Response(
                {
                    "decision": "allow",
                    "reason": "human_approval_consumed",
                    "authorizationEventId": "event-1",
                }
            )

        with patch("urllib.request.urlopen", fake_urlopen):
            result = client.protect("finance-agent").execute_approved(
                "stripe",
                "payments.submit",
                "event-1",
                "one-time-token",
            )

        self.assertEqual(
            calls,
            ["https://nodra.example/api/v1/execute-approved"],
        )
        self.assertEqual(result["decision"], "allow")


    def test_authorize_and_wait_claims_approval_automatically(self):
        credential = "ndra_auto_approval_python_12345678901234567890"
        client = Nodra(
            "https://nodra.example",
            credential,
            max_retries=0,
        )
        calls = []

        def fake_urlopen(request, timeout=None):
            calls.append(request.full_url)

            if request.full_url.endswith("/api/v1/authorize"):
                return _Response(
                    {
                        "decision": "require-approval",
                        "reason": "workspace_high_impact_review",
                        "agentId": "finance-agent",
                        "resourceId": "stripe",
                        "action": "payments.submit",
                        "authorizationEventId": "11111111-1111-4111-8111-111111111111",
                    }
                )

            if request.full_url.endswith("/api/v1/approval-status"):
                return _Response(
                    {
                        "status": "approved",
                        "reason": "approved by analyst",
                    }
                )

            if request.full_url.endswith("/api/v1/approval-claim"):
                return _Response(
                    {
                        "status": "approved",
                        "expiresAt": "2026-09-26T12:00:00Z",
                    }
                )

            if request.full_url.endswith("/api/v1/execute-approved"):
                return _Response(
                    {
                        "decision": "allow",
                        "reason": "human_approval_consumed",
                        "authorizationEventId": "11111111-1111-4111-8111-111111111111",
                    }
                )

            raise AssertionError(f"Unexpected URL: {request.full_url}")

        with patch("urllib.request.urlopen", fake_urlopen):
            decision = client.protect("finance-agent").authorize_and_wait(
                "stripe",
                "payments.submit",
                timeout_seconds=2,
                poll_interval_seconds=0.25,
            )

        self.assertEqual(decision["decision"], "allow")
        self.assertEqual(
            calls,
            [
                "https://nodra.example/api/v1/authorize",
                "https://nodra.example/api/v1/approval-status",
                "https://nodra.example/api/v1/approval-claim",
                "https://nodra.example/api/v1/execute-approved",
            ],
        )

    def test_structured_error_exposes_server_code(self):
        credential = "ndra_test_customer_credential_1234567890"
        client = Nodra(
            "https://nodra.example",
            credential,
            max_retries=0,
        )

        def fake_urlopen(request, timeout=None):
            raise urllib.error.HTTPError(
                request.full_url,
                403,
                "Forbidden",
                {},
                None,
            )

        with patch("urllib.request.urlopen", fake_urlopen):
            with self.assertRaises(NodraError) as captured:
                client.authorize("finance-agent", "stripe", "payments.submit")

        self.assertEqual(captured.exception.status, 403)
        self.assertEqual(captured.exception.code, "nodra_http_403")
        self.assertFalse(captured.exception.retryable)

    def test_record_rejects_invalid_decision(self):
        credential = "ndra_test_customer_credential_1234567890"
        client = Nodra("https://nodra.example", credential)

        with self.assertRaises(NodraError) as captured:
            client.protect("finance-agent").record(
                "stripe",
                "payments.submit",
                "maybe",
            )

        self.assertEqual(captured.exception.code, "invalid_request")


if __name__ == "__main__":
    unittest.main()
