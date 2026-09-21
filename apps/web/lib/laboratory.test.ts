import test from "node:test";
import assert from "node:assert/strict";
import { containLaboratoryIncident, fiveAgentScenario, simulateIncident, verifySelectiveContainment } from "./laboratory.ts";

test("five-agent scenario preserves Support outside the blast radius",()=>{
  const affected = new Set<string>([
    fiveAgentScenario.origin,
    ...fiveAgentScenario.propagation.map((edge) => edge.to),
  ]);
  assert.deepEqual([...affected].sort(),[...fiveAgentScenario.expectedContained].sort());
  assert.equal(affected.has("support"),false);
});

test("selective containment accepts affected branch and healthy Support",()=>{
  assert.equal(verifySelectiveContainment({
    research:"quarantined",
    manager:"at-risk",
    finance:"at-risk",
    data:"at-risk",
    support:"healthy",
  }),true);
});

test("selective containment fails if Support is affected",()=>{
  assert.equal(verifySelectiveContainment({
    research:"quarantined",
    manager:"at-risk",
    finance:"at-risk",
    data:"at-risk",
    support:"at-risk",
  }),false);
});


test("compromise simulation cannot expand beyond the evidence-derived branch",()=>{
  const incident = simulateIncident();
  assert.equal(incident.attemptedAction.decision,"deny");
  assert.deepEqual([...incident.affectedAgentIds].sort(),[...fiveAgentScenario.expectedContained].sort());
  assert.equal(incident.affectedAgentIds.includes("support"),false);

  const containment = containLaboratoryIncident();
  const byId = Object.fromEntries(containment.targets.map((agent)=>[agent.id,agent]));
  for (const id of fiveAgentScenario.expectedContained) {
    assert.equal(byId[id]?.delegatedAuthority,false, `${id} retained delegated authority`);
  }
  assert.equal(byId.support?.status,"healthy");
  assert.equal(byId.support?.delegatedAuthority,true);
  assert.deepEqual(containment.preserved,["support"]);
});
