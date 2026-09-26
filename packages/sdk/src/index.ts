import { createHash, createHmac, randomUUID } from "node:crypto";

export type NodraDecision = "allow" | "deny" | "require-approval";

export type NodraEvent = {
  id?: string;
  agentId: string;
  resourceId: string;
  action: string;
  decision: NodraDecision;
  phase?: "intent" | "result";
  executed?: boolean;
  outcome?: string;
  reason?: string;
  causedBy?: string;
  causedByEventId?: string;
  incidentId?: string;
  occurredAt?: string;
};

export type NodraConfig = {
  baseUrl: string;
  credential: string;
  /**
   * Reserved for future explicit multi-workspace routing.
   * Current credentials are already workspace-bound by the server.
   */
  workspaceId?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetch?: typeof globalThis.fetch;
};

export type AuthorizationRequest = {
  agentId: string;
  resourceId: string;
  action: string;
};

export type AuthorizationDecision = {
  decision: NodraDecision;
  reason: string;
  agentId: string;
  resourceId: string;
  action: string;
  authorizationEventId: string;
};

export type ApprovedExecutionRequest = {
  agentId: string;
  resourceId: string;
  action: string;
  authorizationEventId: string;
  executionToken: string;
};

export type ApprovedExecutionDecision = {
  decision: "allow";
  reason: "human_approval_consumed";
  authorizationEventId: string;
  executionEventId?: string | null;
  agentId: string;
  resourceId: string;
  action: string;
};

export class NodraError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly requestId?: string;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: {
      code: string;
      status?: number;
      requestId?: string;
      retryable?: boolean;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "NodraError";
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.retryable = Boolean(options.retryable);
  }
}

type SignedHeaders = {
  "x-nodra-credential": string;
  "x-nodra-timestamp": string;
  "x-nodra-nonce": string;
  "x-nodra-signature": string;
  "x-nodra-sdk-version": string;
};

const SDK_VERSION = "0.1.0";
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_RETRIES = 2;

function normalizeBaseUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new NodraError("Nodra baseUrl must be a valid absolute URL.", {
      code: "invalid_base_url",
    });
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new NodraError("Nodra baseUrl must use http or https.", {
      code: "invalid_base_url",
    });
  }

  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

function sign(body: string, config: Required<Pick<NodraConfig, "credential">>): SignedHeaders {
  if (config.credential.length < 32) {
    throw new NodraError("Nodra credential must contain at least 32 characters.", {
      code: "credential_too_short",
    });
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomUUID();
  const bodyDigest = createHash("sha256").update(body).digest("hex");
  const canonical = ["v1", timestamp, nonce, bodyDigest].join("\n");
  const digest = createHmac("sha256", config.credential)
    .update(canonical)
    .digest("hex");

  return {
    "x-nodra-credential": config.credential,
    "x-nodra-timestamp": timestamp,
    "x-nodra-nonce": nonce,
    "x-nodra-signature": "v1=" + digest,
    "x-nodra-sdk-version": SDK_VERSION,
  };
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function jitteredBackoff(attempt: number) {
  const base = Math.min(1_000, 100 * 2 ** attempt);
  return base + Math.floor(Math.random() * 75);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function assertNonEmpty(value: string, field: string) {
  if (!value || !value.trim()) {
    throw new NodraError(`${field} is required.`, {
      code: "invalid_request",
    });
  }
}

export class Nodra {
  private readonly baseUrl: string;
  private readonly credential: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(config: NodraConfig) {
    if (!config || typeof config !== "object") {
      throw new NodraError("Nodra configuration is required.", {
        code: "invalid_config",
      });
    }

    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.credential = config.credential;
    this.timeoutMs = Math.max(250, config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    this.maxRetries = Math.max(0, Math.min(5, config.maxRetries ?? DEFAULT_MAX_RETRIES));
    this.fetchImpl = config.fetch ?? globalThis.fetch;

    if (typeof this.fetchImpl !== "function") {
      throw new NodraError("A fetch implementation is required.", {
        code: "fetch_unavailable",
      });
    }

    if (this.credential.length < 32) {
      throw new NodraError("Nodra credential must contain at least 32 characters.", {
        code: "credential_too_short",
      });
    }
  }

  protect(agent: { id: string; name?: string }) {
    assertNonEmpty(agent.id, "agent.id");

    return {
      authorize: (request: { resourceId: string; action: string }) =>
        this.authorize({ agentId: agent.id, ...request }),

      executeApproved: (request: {
        resourceId: string;
        action: string;
        authorizationEventId: string;
        executionToken: string;
      }) =>
        this.executeApproved({
          agentId: agent.id,
          ...request,
        }),

      record: (event: Omit<NodraEvent, "agentId">) =>
        this.record({ ...event, agentId: agent.id }),

      intent: (
        event: Omit<NodraEvent, "agentId" | "phase" | "executed">,
      ) =>
        this.record({
          ...event,
          agentId: agent.id,
          phase: "intent",
          executed: false,
        }),

      result: (event: Omit<NodraEvent, "agentId" | "phase">) =>
        this.record({
          ...event,
          agentId: agent.id,
          phase: "result",
        }),
    };
  }

  async authorize(request: AuthorizationRequest): Promise<AuthorizationDecision> {
    assertNonEmpty(request.agentId, "agentId");
    assertNonEmpty(request.resourceId, "resourceId");
    assertNonEmpty(request.action, "action");

    return this.post<AuthorizationDecision>("/api/v1/authorize", request, {
      retrySafe: true,
      operation: "authorization",
    });
  }

  async executeApproved(
    request: ApprovedExecutionRequest,
  ): Promise<ApprovedExecutionDecision> {
    assertNonEmpty(request.agentId, "agentId");
    assertNonEmpty(request.resourceId, "resourceId");
    assertNonEmpty(request.action, "action");
    assertNonEmpty(request.authorizationEventId, "authorizationEventId");
    assertNonEmpty(request.executionToken, "executionToken");

    // Approval tokens are one-time. Do not automatically retry after a request
    // may have reached the server.
    return this.post<ApprovedExecutionDecision>(
      "/api/v1/execute-approved",
      request,
      {
        retrySafe: false,
        operation: "approved execution",
      },
    );
  }

  async record(event: NodraEvent): Promise<{
    recorded: boolean;
    eventId?: string | null;
    incidentId?: string | null;
  }> {
    assertNonEmpty(event.agentId, "agentId");
    assertNonEmpty(event.resourceId, "resourceId");
    assertNonEmpty(event.action, "action");

    const payload = { ...event, id: event.id ?? randomUUID() };

    // Event IDs make record requests idempotency-friendly, but the server still
    // protects nonce replay. A network retry gets a fresh signed request.
    return this.post("/api/v1/events", payload, {
      retrySafe: true,
      operation: "event recording",
    });
  }

  private async post<T>(
    path: string,
    payload: unknown,
    options: { retrySafe: boolean; operation: string },
  ): Promise<T> {
    const body = JSON.stringify(payload);
    const endpoint = new URL(path, this.baseUrl);
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const headers = sign(body, { credential: this.credential });

      try {
        const response = await this.fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            ...headers,
          },
          body,
          signal: controller.signal,
        });

        const requestId =
          response.headers.get("x-request-id") ??
          response.headers.get("x-nodra-request-id") ??
          undefined;

        const data = await response.json().catch(() => ({}));

        if (response.ok) {
          return data as T;
        }

        const code = String(
          (data as { error?: string })?.error ??
            `nodra_http_${response.status}`,
        );
        const retryable =
          options.retrySafe && isRetryableStatus(response.status);

        const error = new NodraError(
          `Nodra ${options.operation} failed: ${code}`,
          {
            code,
            status: response.status,
            requestId,
            retryable,
          },
        );

        if (!retryable || attempt >= this.maxRetries) {
          throw error;
        }

        const retryAfter = Number(response.headers.get("retry-after"));
        await delay(
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1_000
            : jitteredBackoff(attempt),
        );
        lastError = error;
      } catch (error) {
        if (error instanceof NodraError) {
          if (!error.retryable || attempt >= this.maxRetries) throw error;
          lastError = error;
          continue;
        }

        const aborted =
          error instanceof DOMException && error.name === "AbortError";
        const wrapped = new NodraError(
          aborted
            ? `Nodra ${options.operation} timed out after ${this.timeoutMs}ms.`
            : `Nodra ${options.operation} could not reach the gateway.`,
          {
            code: aborted ? "request_timeout" : "network_error",
            retryable: options.retrySafe,
            cause: error,
          },
        );

        if (!options.retrySafe || attempt >= this.maxRetries) throw wrapped;

        lastError = wrapped;
        await delay(jitteredBackoff(attempt));
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new NodraError(`Nodra ${options.operation} failed.`, {
          code: "unknown_error",
        });
  }
}

