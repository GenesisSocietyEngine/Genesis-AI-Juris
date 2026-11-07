import type { Metadata } from "next";
import { getChatGPTUser, chatGPTSignInPath } from "../chatgpt-auth";
import OrganizationBoundary from "../organizations/OrganizationBoundary";
import LibraryClient from "./LibraryClient";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Library · CaseVant",robots:{index:false,follow:false}};
export default async function LibraryPage(){const identity=await getChatGPTUser();return <OrganizationBoundary signedIn={Boolean(identity)} signInUrl={chatGPTSignInPath("/library")}><LibraryClient/></OrganizationBoundary>;}
