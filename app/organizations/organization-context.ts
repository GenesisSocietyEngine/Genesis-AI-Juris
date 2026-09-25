"use client";
import { createContext, useContext } from "react";
import type { ClientOrganization } from "../organization-client";
export const OrganizationContext = createContext<ClientOrganization | null>(null);
export const useActiveOrganization = () => useContext(OrganizationContext);
