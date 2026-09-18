import { createObservableGateway } from "@nodra/runtime";

const rules=[
 {agentId:"example-research",resourceId:"notes",actions:["write"]},
 {agentId:"example-research",resourceId:"browser",actions:["read"]},
];

export function createProtectedResearchAgent(observer:any){
 const gateway=createObservableGateway(rules,observer);
 gateway.register("notes",async(input)=>({saved:true,input}));
 gateway.register("browser",async(input)=>({fetched:true,input}));
 return {
   async act(resourceId:string,action:string,input:unknown){
     return gateway.execute({id:crypto.randomUUID(),agentId:"example-research",resourceId,action},input);
   }
 };
}
