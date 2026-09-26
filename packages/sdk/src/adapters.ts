import type { Nodra } from "./index.js";

export type ProtectedToolInput = {
  agentId: string;
  resourceId: string;
  action: string;
  input?: unknown;
};

export type ProtectedToolOptions = {
  waitForApproval?: boolean;
  approvalTimeoutMs?: number;
  approvalPollIntervalMs?: number;
};

export async function protectTool<T>(
  nodra: Nodra,
  request: ProtectedToolInput,
  execute: () => Promise<T>,
  options: ProtectedToolOptions = {},
) {
  const decision = options.waitForApproval
    ? await nodra.authorizeAndWait(request, {
        timeoutMs: options.approvalTimeoutMs,
        pollIntervalMs: options.approvalPollIntervalMs,
      })
    : await nodra.authorize(request);

  if (decision.decision !== "allow") {
    return { executed: false as const, decision };
  }

  try {
    const result = await execute();

    await nodra.record({
      ...request,
      id: crypto.randomUUID(),
      decision: "allow",
      phase: "result",
      executed: true,
      reason: decision.reason,
    });

    return { executed: true as const, decision, result };
  } catch (error) {
    await nodra.record({
      ...request,
      id: crypto.randomUUID(),
      decision: "deny",
      phase: "result",
      executed: true,
      outcome: "failed",
      reason: "protected_tool_failed",
    });
    throw error;
  }
}

export function mcpGuard(
  nodra: Nodra,
  agentId: string,
  options: ProtectedToolOptions = {},
) {
  return async <T>(toolName: string, execute: () => Promise<T>) =>
    protectTool(
      nodra,
      { agentId, resourceId: "mcp:" + toolName, action: "tool:call" },
      execute,
      options,
    );
}

export function openAIGuard(
  nodra: Nodra,
  agentId: string,
  options: ProtectedToolOptions = {},
) {
  return async <T>(toolName: string, execute: () => Promise<T>) =>
    protectTool(
      nodra,
      { agentId, resourceId: "openai:" + toolName, action: "tool:call" },
      execute,
      options,
    );
}

export function langChainGuard(
  nodra: Nodra,
  agentId: string,
  options: ProtectedToolOptions = {},
) {
  return async <T>(toolName: string, execute: () => Promise<T>) =>
    protectTool(
      nodra,
      { agentId, resourceId: "langchain:" + toolName, action: "tool:call" },
      execute,
      options,
    );
}

export function crewAIGuard(
  nodra: Nodra,
  agentId: string,
  options: ProtectedToolOptions = {},
) {
  return async <T>(toolName: string, execute: () => Promise<T>) =>
    protectTool(
      nodra,
      { agentId, resourceId: "crewai:" + toolName, action: "tool:call" },
      execute,
      options,
    );
}

export function restGuard(
  nodra: Nodra,
  agentId: string,
  options: ProtectedToolOptions = {},
) {
  return async <T>(method: string, url: string, execute: () => Promise<T>) =>
    protectTool(
      nodra,
      {
        agentId,
        resourceId: "rest:" + url,
        action: method.toUpperCase(),
      },
      execute,
      options,
    );
}
