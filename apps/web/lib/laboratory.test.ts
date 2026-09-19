import test from "node:test";
import assert from "node:assert/strict";
import { fiveAgentScenario, verifySelectiveContainment } from "./laboratory.ts";

test("five-agent scenario preserves Support outside the blast radius",()=>{
  const affected=new Set([fiveAgentScenario.origin,...fiveAgentScenario.propagation.map(edge=>edge.to)]);
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
