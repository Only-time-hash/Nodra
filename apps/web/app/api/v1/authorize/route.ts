import { POST as authorize } from "../../gateway/authorize/route";
import { versionedResponse } from "../../../../lib/versioned-api";

export async function POST(request: Request) {
  return versionedResponse(authorize, request);
}
