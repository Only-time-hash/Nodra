import type {Nodra} from "./index";

export type ProtectedToolInput={agentId:string;resourceId:string;action:string;input?:unknown};
export async function protectTool<T>(nodra:Nodra,request:ProtectedToolInput,execute:()=>Promise<T>){
 const decision=await nodra.authorize(request);
 if(decision.decision!=="allow")return {executed:false as const,decision};
 try{
  const result=await execute();
  await nodra.record({...request,id:crypto.randomUUID(),decision:"allow",phase:"result"});
  return {executed:true as const,decision,result};
 }catch(error){
  await nodra.record({...request,id:crypto.randomUUID(),decision:"deny",phase:"result"});
  throw error;
 }
}
export function mcpGuard(nodra:Nodra,agentId:string){
 return async<T>(toolName:string,execute:()=>Promise<T>)=>protectTool(nodra,{agentId,resourceId:"mcp:"+toolName,action:"tool:call"},execute);
}
export function openAIGuard(nodra:Nodra,agentId:string){
 return async<T>(toolName:string,execute:()=>Promise<T>)=>protectTool(nodra,{agentId,resourceId:"openai:"+toolName,action:"tool:call"},execute);
}
export function langChainGuard(nodra:Nodra,agentId:string){
 return async<T>(toolName:string,execute:()=>Promise<T>)=>protectTool(nodra,{agentId,resourceId:"langchain:"+toolName,action:"tool:call"},execute);
}
export function crewAIGuard(nodra:Nodra,agentId:string){
 return async<T>(toolName:string,execute:()=>Promise<T>)=>protectTool(nodra,{agentId,resourceId:"crewai:"+toolName,action:"tool:call"},execute);
}
export function restGuard(nodra:Nodra,agentId:string){
 return async<T>(method:string,url:string,execute:()=>Promise<T>)=>protectTool(nodra,{agentId,resourceId:"rest:"+url,action:method.toUpperCase()},execute);
}
