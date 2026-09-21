import { describe,it } from "node:test";
import assert from "node:assert/strict";
import { buildRecoveryPlan,assessSafeRestart } from "./recovery.ts";

describe("recovery",()=>{
  it("never marks restart safe before all checks pass",()=>{
    const plan=buildRecoveryPlan("inc-1",[{id:"a1",agentId:"research",kind:"memory-write",target:"research-notes",reversibility:"reversible"}]);
    assert.equal(plan.safeToRestart,false);
    assert.equal(assessSafeRestart(plan,{originPatched:true,credentialsRotated:true,memoryReviewed:true,pendingJobsReviewed:true,humanApproved:false}).safeToRestart,false);
    assert.equal(assessSafeRestart(plan,{originPatched:true,credentialsRotated:true,memoryReviewed:true,pendingJobsReviewed:true,humanApproved:true}).safeToRestart,true);
  });

  for (const missing of ["originPatched","credentialsRotated","memoryReviewed","pendingJobsReviewed","humanApproved"] as const) {
    it(`rejects restart bypass when ${missing} is missing`,()=>{
      const plan=buildRecoveryPlan("inc-attack",[{id:"a1",agentId:"research",kind:"memory-write",target:"research-notes",reversibility:"reversible"}]);
      const checks={originPatched:true,credentialsRotated:true,memoryReviewed:true,pendingJobsReviewed:true,humanApproved:true};
      checks[missing]=false;
      const result=assessSafeRestart(plan,checks);
      assert.equal(result.safeToRestart,false);
    });
  }
});
