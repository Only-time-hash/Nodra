export type IncidentState = "open" | "contained" | "recovering" | "resolved";
export type IncidentRecord = {
  id:string;
  state:IncidentState;
  originAgentId:string;
  openedAt:string;
  affectedAgentIds:string[];
  evidenceEventIds:string[];
};

export function createIncident(input:Omit<IncidentRecord,"state">):IncidentRecord {
  return {...input,state:"open"};
}
