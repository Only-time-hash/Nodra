import { NextResponse } from "next/server";
import { containLaboratoryIncident } from "../../../../lib/laboratory";
export function POST(){return NextResponse.json(containLaboratoryIncident());}
