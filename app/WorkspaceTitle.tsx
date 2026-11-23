"use client";
import { useEffect } from "react";
import { useInterfaceLocale, useWorkspaceLocation } from "./use-interface-locale";
import { workspaceTitle } from "./workspace-title";

export default function WorkspaceTitle() {
  const [locale] = useInterfaceLocale();
  const location = useWorkspaceLocation();
  const title = workspaceTitle(location, locale);
  useEffect(() => { if (title !== null) document.title = title; }, [title]);
  return null;
}
