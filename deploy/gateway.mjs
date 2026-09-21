import http from "node:http";
const port=Number(process.env.PORT||8787),base=process.env.NODRA_BASE_URL;
if(!base)throw new Error("NODRA_BASE_URL is required");
const server=http.createServer(async(req,res)=>{
 if(req.method==="GET"&&req.url==="/health"){res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({ok:true,service:"nodra-gateway"}))}
 res.writeHead(404,{"content-type":"application/json"});res.end(JSON.stringify({error:"not_found"}));
});
server.listen(port,()=>console.log("Nodra gateway listening on :"+port));
