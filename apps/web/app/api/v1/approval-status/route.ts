import { POST as approvalStatus } from "../../gateway/approval-status/route";
import { versionedResponse } from "../../../../lib/versioned-api";

export async function POST(request: Request) {
  return versionedResponse(approvalStatus, request);
}
