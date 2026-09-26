import { randomUUID } from "node:crypto";

export const NODRA_API_VERSION = "v1";

export async function versionedResponse(
  handler: (request: Request) => Promise<Response>,
  request: Request,
): Promise<Response> {
  const requestId =
    request.headers.get("x-nodra-request-id")?.trim() || randomUUID();

  const response = await handler(request);
  response.headers.set("x-nodra-request-id", requestId);
  response.headers.set("x-nodra-api-version", NODRA_API_VERSION);
  response.headers.set("cache-control", "no-store");
  return response;
}
