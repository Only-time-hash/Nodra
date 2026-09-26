import { POST as approvalClaim } from "../../gateway/approval-claim/route";
import { versionedResponse } from "../../../../lib/versioned-api";

export async function POST(request: Request) {
  return versionedResponse(approvalClaim, request);
}
