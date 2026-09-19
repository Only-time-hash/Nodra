import type { GatewayObserver } from "@nodra/runtime";
import { signGatewayRequest } from "./gateway-signing";

type FlightRecorderObserverOptions = {
  endpoint?: string;
  cookie?: string | null;
  signingIdentity: {
    workspaceId: string;
    agentId: string;
    masterSecret: string;
  };
};

export function createFlightRecorderObserver(options: FlightRecorderObserverOptions): GatewayObserver {
  const endpoint = options.endpoint ?? "/api/gateway/events";

  return async (event) => {
    const body = JSON.stringify(event);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...signGatewayRequest(body, options.signingIdentity),
    };
    if (options.cookie) headers.cookie = options.cookie;

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`Nodra flight recorder rejected gateway event: ${response.status}`);
    }
  };
}
