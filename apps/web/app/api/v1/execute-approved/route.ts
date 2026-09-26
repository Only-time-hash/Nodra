import { POST as executeApproved } from "../../gateway/execute-approved/route";
import { versionedResponse } from "../../../../lib/versioned-api";

export async function POST(request: Request) {
  return versionedResponse(executeApproved, request);
}
