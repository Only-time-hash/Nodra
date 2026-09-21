import test from "node:test";
import assert from "node:assert/strict";
import {hashIntegrationSecret,issueIntegrationSecret} from "./integration-credentials.ts";

test("issued integration secrets are strong, prefixed and one-way stored",()=>{
 const issued=issueIntegrationSecret();
 assert.match(issued.secret,/^ndra_[A-Za-z0-9_-]+$/);
 assert.equal(issued.secret.length>=40,true);
 assert.equal(issued.hash,hashIntegrationSecret(issued.secret));
 assert.notEqual(issued.hash,issued.secret);
 assert.equal(issued.prefix,issued.secret.slice(0,12));
});
test("same credential hashes deterministically for lookup",()=>{
 const secret="ndra_test_credential_123456789012345678";
 assert.equal(hashIntegrationSecret(secret),hashIntegrationSecret(secret));
});
