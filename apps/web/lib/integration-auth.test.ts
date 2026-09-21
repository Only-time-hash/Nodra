import test from "node:test";
import assert from "node:assert/strict";
import {hashIntegrationSecret,issueIntegrationSecret} from "./integration-credentials";

test("customer credential lookup uses a one-way hash",()=>{
 const issued=issueIntegrationSecret();
 assert.equal(hashIntegrationSecret(issued.secret),issued.hash);
 assert.notEqual(issued.hash,issued.secret);
});

test("customer credentials have a stable ndra prefix",()=>{
 const issued=issueIntegrationSecret();
 assert.match(issued.secret,/^ndra_/);
 assert.equal(issued.prefix,issued.secret.slice(0,12));
});
