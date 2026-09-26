import { POST as recordEvent } from "../../gateway/events/route";
import { versionedResponse } from "../../../../lib/versioned-api";

export async function POST(request: Request) {
  return versionedResponse(recordEvent, request);
}
