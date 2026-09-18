import { NextResponse } from "next/server";
import { buildRecoveryPlan } from "@nodra/recovery";
export function POST(){return NextResponse.json(buildRecoveryPlan("lab-incident-001",[
{id:"memory-1",agentId:"research",kind:"memory-write",target:"research-notes",reversibility:"reversible"},
{id:"credential-1",agentId:"research",kind:"credential-use",target:"sandbox-browser-session",reversibility:"human-review"}
]));}
