export const PERSONAL_FILE_LIMIT = 8 * 1024 * 1024;
export const PERSONAL_CASE_FILE_LIMIT = 24 * 1024 * 1024;
export type PersonalStudioFile = {id:string;filename:string;mediaType:string;byteLength:number;sha256:string;nodeIds:string[];createdAt:string;caseVersion:string;sourceFingerprint:string;status:"ready"|"pending"};
export type PersonalFileRegistry = {revision:number;files:PersonalStudioFile[]};
export function validPersonalFile(value:unknown):value is PersonalStudioFile{
 if(!value||typeof value!=="object"||Array.isArray(value))return false;const v=value as PersonalStudioFile;
 return /^[a-f0-9-]{36}$/.test(v.id)&&typeof v.filename==="string"&&v.filename.length>0&&v.filename.length<=240&&["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","text/plain","text/markdown"].includes(v.mediaType)&&Number.isSafeInteger(v.byteLength)&&v.byteLength>0&&v.byteLength<=PERSONAL_FILE_LIMIT&&/^sha256-[a-f0-9]{64}$/.test(v.sha256)&&Array.isArray(v.nodeIds)&&v.nodeIds.length<=200&&new Set(v.nodeIds).size===v.nodeIds.length&&v.nodeIds.every(id=>typeof id==="string"&&id.length<=128&&/^[A-Za-z0-9_-]+$/.test(id))&&typeof v.caseVersion==="string"&&v.caseVersion.length<=64&&/^sha256-[a-f0-9]{64}$/.test(v.sourceFingerprint)&&typeof v.createdAt==="string"&&Number.isFinite(Date.parse(v.createdAt))&&["ready","pending"].includes(v.status);
}
export function parsePersonalFiles(value:unknown):PersonalFileRegistry|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;const v=value as PersonalFileRegistry;
 return Number.isSafeInteger(v.revision)&&v.revision>=0&&Array.isArray(v.files)&&v.files.length<=100&&v.files.every(validPersonalFile)?v:null;
}
