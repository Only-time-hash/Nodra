import { NextResponse } from "next/server";
import { NODRA_API_VERSION } from "../../../../lib/versioned-api";

export async function GET() {
  return NextResponse.json(
    {
      service: "nodra-api",
      version: NODRA_API_VERSION,
      status: "ok",
    },
    {
      headers: {
        "cache-control": "no-store",
        "x-nodra-api-version": NODRA_API_VERSION,
      },
    },
  );
}
