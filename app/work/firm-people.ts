import type {FirmCase} from "./work-controller";
export type PersonScope="active"|"inactive"|"all";
export type FirmPerson={key:string;actorId:string|null;names:string[];memberships:{caseId:string;caseTitle:string;participantId:string;name:string;active:boolean}[]};
/** Exact linked identities only. Unlinked participants remain case-local. */
export function firmPeople(cases:FirmCase[],scope:PersonScope="active"){
 const groups=new Map<string,FirmPerson>();
 for(const matter of cases)for(const person of matter.participants){
  if(scope!=="all"&&person.active!==(scope==="active"))continue;
  const key=JSON.stringify(person.actorId?["actor",person.actorId]:["case",matter.id,person.id]);
  const group:FirmPerson=groups.get(key)??{key,actorId:person.actorId,names:[],memberships:[]};
  if(!group.names.includes(person.name))group.names.push(person.name);
  group.memberships.push({caseId:matter.id,caseTitle:matter.title,participantId:person.id,name:person.name,active:person.active});groups.set(key,group);
 }
 return [...groups.values()].map(group=>({...group,names:group.names.sort(),memberships:group.memberships.sort((a,b)=>a.caseTitle.localeCompare(b.caseTitle)||a.caseId.localeCompare(b.caseId))})).sort((a,b)=>a.names[0].localeCompare(b.names[0])||a.key.localeCompare(b.key));
}

