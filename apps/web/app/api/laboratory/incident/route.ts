import { NextResponse } from "next/server";
import { simulateIncident } from "../../../../lib/laboratory";
export function POST(){return NextResponse.json(simulateIncident());}
