export type Reversibility = "reversible" | "human-review" | "irreversible" | "unknown";
export type AffectedAction = { id:string; agentId:string; kind:string; target:string; reversibility:Reversibility };
export type RecoveryStep = { id:string; title:string; reason:string; requiresHuman:boolean; status:"pending"|"ready" };
export type RecoveryPlan = { incidentId:string; safeToRestart:boolean; steps:RecoveryStep[] };

export function buildRecoveryPlan(incidentId:string, actions:AffectedAction[]):RecoveryPlan {
  const steps:RecoveryStep[]=[];
  for (const action of actions) {
    if (action.kind === "credential-use") steps.push({id:`rotate-${action.id}`,title:`Rotate credential for ${action.target}`,reason:"Credential was in the affected authority path.",requiresHuman:true,status:"pending"});
    if (action.kind === "memory-write") steps.push({id:`clean-${action.id}`,title:`Review and clean ${action.target}`,reason:"Memory/state was written during the incident window.",requiresHuman:true,status:"pending"});
    if (action.kind === "scheduled-job") steps.push({id:`cancel-${action.id}`,title:`Review scheduled job ${action.target}`,reason:"A downstream job may outlive containment.",requiresHuman:true,status:"pending"});
    if (action.reversibility === "irreversible") steps.push({id:`review-${action.id}`,title:`Human review: ${action.target}`,reason:"The recorded action cannot be automatically reversed.",requiresHuman:true,status:"pending"});
  }
  if (!steps.length) steps.push({id:"verify-origin",title:"Verify incident origin is isolated",reason:"Containment must be verified before restart.",requiresHuman:true,status:"pending"});
  return {incidentId,safeToRestart:false,steps};
}

export function assessSafeRestart(plan:RecoveryPlan, checks:{originPatched:boolean;credentialsRotated:boolean;memoryReviewed:boolean;pendingJobsReviewed:boolean;humanApproved:boolean}) {
  const safe = Object.values(checks).every(Boolean);
  return {...plan,safeToRestart:safe};
}
