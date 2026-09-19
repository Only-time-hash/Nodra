import type { GatewayObserver } from "@nodra/runtime";

type FlightRecorderObserverOptions = {
  endpoint?: string;
  cookie?: string | null;
};

export function createFlightRecorderObserver(options: FlightRecorderObserverOptions = {}): GatewayObserver {
  const endpoint = options.endpoint ?? "/api/gateway/events";

  return async (event) => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (options.cookie) headers.cookie = options.cookie;

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(`Nodra flight recorder rejected gateway event: ${response.status}`);
    }
  };
}
