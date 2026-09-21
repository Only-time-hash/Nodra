import hashlib,hmac,json,secrets,time,urllib.request,urllib.error,uuid

class Nodra:
    def __init__(self,base_url,workspace_id,credential):
        if len(credential)<32: raise ValueError("Nodra credential must contain at least 32 characters.")
        self.base_url=base_url.rstrip("/");self.workspace_id=workspace_id;self.credential=credential
    def protect(self,agent_id): return NodraAgent(self,agent_id)
    def authorize(self,agent_id,resource_id,action): return self.protect(agent_id).authorize(resource_id,action)
    def _post(self,path,payload,agent_id):
        body=json.dumps(payload,separators=(",",":")).encode()
        ts=str(int(time.time()));nonce=secrets.token_urlsafe(24)
        key=hmac.new(self.credential.encode(),("nodra-agent-key-v1\n"+self.workspace_id+"\n"+agent_id).encode(),hashlib.sha256).digest()
        digest=hashlib.sha256(body).hexdigest()
        canonical=("v1\n"+ts+"\n"+nonce+"\n"+digest).encode()
        signature="v1="+hmac.new(self.credential.encode(),canonical,hashlib.sha256).hexdigest()
        req=urllib.request.Request(self.base_url+path,data=body,method="POST",headers={"Content-Type":"application/json","x-nodra-credential":self.credential,"x-nodra-timestamp":ts,"x-nodra-nonce":nonce,"x-nodra-signature":signature})
        try:
            with urllib.request.urlopen(req,timeout=15) as r:return json.loads(r.read())
        except urllib.error.HTTPError as e: raise RuntimeError("Nodra request failed: "+e.read().decode()) from e

class NodraAgent:
    def __init__(self,client,agent_id):self.client=client;self.agent_id=agent_id
    def authorize(self,resource_id,action):return self.client._post("/api/gateway/authorize",{"agentId":self.agent_id,"resourceId":resource_id,"action":action},self.agent_id)
    def record(self,resource_id,action,decision,phase="result",executed=False,**extra):
        payload={"id":str(uuid.uuid4()),"agentId":self.agent_id,"resourceId":resource_id,"action":action,"decision":decision,"phase":phase,"executed":executed,**extra}
        return self.client._post("/api/gateway/events",payload,self.agent_id)
