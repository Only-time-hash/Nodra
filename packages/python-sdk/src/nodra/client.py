from __future__ import annotations

import hashlib
import hmac
import json
import random
import secrets
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Any

SDK_VERSION = "0.1.0"
DEFAULT_TIMEOUT_SECONDS = 8.0
DEFAULT_MAX_RETRIES = 2


class NodraError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        code: str,
        status: int | None = None,
        request_id: str | None = None,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status = status
        self.request_id = request_id
        self.retryable = retryable


def _normalize_base_url(value: str) -> str:
    parsed = urllib.parse.urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise NodraError(
            "Nodra base_url must be an absolute http(s) URL.",
            code="invalid_base_url",
        )
    return value.rstrip("/")


def _validate_required(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise NodraError(f"{field} is required.", code="invalid_request")


def _retryable_status(status: int) -> bool:
    return status in {408, 425, 429} or status >= 500


class Nodra:
    def __init__(
        self,
        base_url: str,
        credential: str,
        workspace_id: str | None = None,
        *,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> None:
        if not isinstance(credential, str) or len(credential) < 32:
            raise NodraError(
                "Nodra credential must contain at least 32 characters.",
                code="credential_too_short",
            )

        self.base_url = _normalize_base_url(base_url)
        self.workspace_id = workspace_id
        self.credential = credential
        self.timeout_seconds = max(0.25, float(timeout_seconds))
        self.max_retries = max(0, min(5, int(max_retries)))

    def protect(self, agent_id: str) -> "NodraAgent":
        _validate_required(agent_id, "agent_id")
        return NodraAgent(self, agent_id)

    def authorize(
        self,
        agent_id: str,
        resource_id: str,
        action: str,
    ) -> dict[str, Any]:
        return self.protect(agent_id).authorize(resource_id, action)

    def execute_approved(
        self,
        agent_id: str,
        resource_id: str,
        action: str,
        authorization_event_id: str,
        execution_token: str,
    ) -> dict[str, Any]:
        return self.protect(agent_id).execute_approved(
            resource_id,
            action,
            authorization_event_id,
            execution_token,
        )

    def wait_for_approval(
        self,
        agent_id: str,
        resource_id: str,
        action: str,
        authorization_event_id: str,
        *,
        timeout_seconds: float = 300.0,
        poll_interval_seconds: float = 1.5,
    ) -> dict[str, Any]:
        return self.protect(agent_id).wait_for_approval(
            resource_id,
            action,
            authorization_event_id,
            timeout_seconds=timeout_seconds,
            poll_interval_seconds=poll_interval_seconds,
        )

    def authorize_and_wait(
        self,
        agent_id: str,
        resource_id: str,
        action: str,
        *,
        timeout_seconds: float = 300.0,
        poll_interval_seconds: float = 1.5,
    ) -> dict[str, Any]:
        return self.protect(agent_id).authorize_and_wait(
            resource_id,
            action,
            timeout_seconds=timeout_seconds,
            poll_interval_seconds=poll_interval_seconds,
        )

    def _signed_headers(self, body: bytes) -> dict[str, str]:
        timestamp = str(int(time.time()))
        nonce = str(uuid.uuid4())
        body_digest = hashlib.sha256(body).hexdigest()
        canonical = f"v1\n{timestamp}\n{nonce}\n{body_digest}".encode()
        signature = "v1=" + hmac.new(
            self.credential.encode(),
            canonical,
            hashlib.sha256,
        ).hexdigest()

        return {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-nodra-credential": self.credential,
            "x-nodra-timestamp": timestamp,
            "x-nodra-nonce": nonce,
            "x-nodra-signature": signature,
            "x-nodra-sdk-version": SDK_VERSION,
        }

    def _post(
        self,
        path: str,
        payload: dict[str, Any],
        *,
        retry_safe: bool,
        operation: str,
    ) -> dict[str, Any]:
        body = json.dumps(payload, separators=(",", ":")).encode()
        endpoint = self.base_url + path
        last_error: NodraError | None = None

        for attempt in range(self.max_retries + 1):
            request = urllib.request.Request(
                endpoint,
                data=body,
                method="POST",
                headers=self._signed_headers(body),
            )

            try:
                with urllib.request.urlopen(
                    request,
                    timeout=self.timeout_seconds,
                ) as response:
                    raw = response.read()
                    if not raw:
                        return {}
                    return json.loads(raw)

            except urllib.error.HTTPError as exc:
                raw = exc.read()
                try:
                    data = json.loads(raw) if raw else {}
                except json.JSONDecodeError:
                    data = {}

                code = str(data.get("error") or f"nodra_http_{exc.code}")
                request_id = (
                    exc.headers.get("x-request-id")
                    or exc.headers.get("x-nodra-request-id")
                    if exc.headers
                    else None
                )
                retryable = retry_safe and _retryable_status(exc.code)
                error = NodraError(
                    f"Nodra {operation} failed: {code}",
                    code=code,
                    status=exc.code,
                    request_id=request_id,
                    retryable=retryable,
                )

                if not retryable or attempt >= self.max_retries:
                    raise error from exc

                last_error = error
                retry_after = exc.headers.get("retry-after") if exc.headers else None
                if retry_after:
                    try:
                        delay = float(retry_after)
                    except ValueError:
                        delay = self._backoff(attempt)
                else:
                    delay = self._backoff(attempt)
                time.sleep(max(0.0, delay))

            except (urllib.error.URLError, TimeoutError, socket.timeout) as exc:
                retryable = retry_safe
                reason = getattr(exc, "reason", None)
                timed_out = isinstance(exc, (TimeoutError, socket.timeout)) or isinstance(
                    reason, (TimeoutError, socket.timeout)
                )
                error = NodraError(
                    (
                        f"Nodra {operation} timed out after "
                        f"{self.timeout_seconds:g}s."
                        if timed_out
                        else f"Nodra {operation} could not reach the gateway."
                    ),
                    code="request_timeout" if timed_out else "network_error",
                    retryable=retryable,
                )

                if not retryable or attempt >= self.max_retries:
                    raise error from exc

                last_error = error
                time.sleep(self._backoff(attempt))

        if last_error is not None:
            raise last_error

        raise NodraError(
            f"Nodra {operation} failed.",
            code="unknown_error",
        )

    @staticmethod
    def _backoff(attempt: int) -> float:
        base = min(1.0, 0.1 * (2**attempt))
        return base + random.uniform(0.0, 0.075)


class NodraAgent:
    def __init__(self, client: Nodra, agent_id: str) -> None:
        self.client = client
        self.agent_id = agent_id

    def authorize(self, resource_id: str, action: str) -> dict[str, Any]:
        _validate_required(resource_id, "resource_id")
        _validate_required(action, "action")

        return self.client._post(
            "/api/v1/authorize",
            {
                "agentId": self.agent_id,
                "resourceId": resource_id,
                "action": action,
            },
            retry_safe=True,
            operation="authorization",
        )

    def execute_approved(
        self,
        resource_id: str,
        action: str,
        authorization_event_id: str,
        execution_token: str,
    ) -> dict[str, Any]:
        _validate_required(resource_id, "resource_id")
        _validate_required(action, "action")
        _validate_required(authorization_event_id, "authorization_event_id")
        _validate_required(execution_token, "execution_token")

        # The token is one-time. Never automatically retry an execution that
        # may already have reached the Nodra gateway.
        return self.client._post(
            "/api/v1/execute-approved",
            {
                "agentId": self.agent_id,
                "resourceId": resource_id,
                "action": action,
                "authorizationEventId": authorization_event_id,
                "executionToken": execution_token,
            },
            retry_safe=False,
            operation="approved execution",
        )

    def wait_for_approval(
        self,
        resource_id: str,
        action: str,
        authorization_event_id: str,
        *,
        timeout_seconds: float = 300.0,
        poll_interval_seconds: float = 1.5,
    ) -> dict[str, Any]:
        _validate_required(resource_id, "resource_id")
        _validate_required(action, "action")
        _validate_required(authorization_event_id, "authorization_event_id")

        deadline = time.monotonic() + max(1.0, float(timeout_seconds))
        poll_interval = max(0.25, min(10.0, float(poll_interval_seconds)))
        execution_token = secrets.token_urlsafe(32)

        status_payload = {
            "agentId": self.agent_id,
            "resourceId": resource_id,
            "action": action,
            "authorizationEventId": authorization_event_id,
        }

        while time.monotonic() < deadline:
            status = self.client._post(
                "/api/v1/approval-status",
                status_payload,
                retry_safe=True,
                operation="approval status",
            )

            if status.get("status") == "denied":
                raise NodraError(
                    "Human approval was denied.",
                    code="approval_denied",
                    status=403,
                )

            if status.get("status") == "approved":
                claim = self.client._post(
                    "/api/v1/approval-claim",
                    {
                        **status_payload,
                        "executionToken": execution_token,
                    },
                    retry_safe=True,
                    operation="approval claim",
                )

                return {
                    "executionToken": execution_token,
                    "reason": status.get("reason"),
                    "decidedAt": status.get("decidedAt"),
                    "expiresAt": claim.get("expiresAt"),
                }

            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            time.sleep(min(poll_interval, remaining))

        raise NodraError(
            "Timed out waiting for human approval.",
            code="approval_wait_timeout",
        )

    def authorize_and_wait(
        self,
        resource_id: str,
        action: str,
        *,
        timeout_seconds: float = 300.0,
        poll_interval_seconds: float = 1.5,
    ) -> dict[str, Any]:
        decision = self.authorize(resource_id, action)

        if decision.get("decision") != "require-approval":
            return decision

        authorization_event_id = str(decision.get("authorizationEventId") or "")
        _validate_required(authorization_event_id, "authorization_event_id")

        claim = self.wait_for_approval(
            resource_id,
            action,
            authorization_event_id,
            timeout_seconds=timeout_seconds,
            poll_interval_seconds=poll_interval_seconds,
        )

        return self.execute_approved(
            resource_id,
            action,
            authorization_event_id,
            claim["executionToken"],
        )

    def record(
        self,
        resource_id: str,
        action: str,
        decision: str,
        *,
        phase: str = "result",
        executed: bool = False,
        event_id: str | None = None,
        **extra: Any,
    ) -> dict[str, Any]:
        _validate_required(resource_id, "resource_id")
        _validate_required(action, "action")

        if decision not in {"allow", "deny", "require-approval"}:
            raise NodraError(
                "decision must be allow, deny, or require-approval.",
                code="invalid_request",
            )

        payload = {
            "id": event_id or str(uuid.uuid4()),
            "agentId": self.agent_id,
            "resourceId": resource_id,
            "action": action,
            "decision": decision,
            "phase": phase,
            "executed": executed,
            **extra,
        }

        return self.client._post(
            "/api/v1/events",
            payload,
            retry_safe=True,
            operation="event recording",
        )

    def intent(
        self,
        resource_id: str,
        action: str,
        decision: str,
        **extra: Any,
    ) -> dict[str, Any]:
        return self.record(
            resource_id,
            action,
            decision,
            phase="intent",
            executed=False,
            **extra,
        )

    def result(
        self,
        resource_id: str,
        action: str,
        decision: str,
        *,
        executed: bool = False,
        **extra: Any,
    ) -> dict[str, Any]:
        return self.record(
            resource_id,
            action,
            decision,
            phase="result",
            executed=executed,
            **extra,
        )
