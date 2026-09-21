import {createHash,randomBytes} from "node:crypto";
export function issueIntegrationSecret(){
 const secret="ndra_"+randomBytes(32).toString("base64url");
 return {secret,prefix:secret.slice(0,12),hash:hashIntegrationSecret(secret)};
}
export function hashIntegrationSecret(secret:string){return createHash("sha256").update(secret,"utf8").digest("hex")}
