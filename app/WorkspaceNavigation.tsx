"use client";

import { useInterfaceLocale, useWorkspaceLocation } from "./use-interface-locale";
import GenesisNavigation from "./GenesisNavigation";
import { safeWorkspaceReturn } from "./workspace-navigation";

export default function WorkspaceNavigation({ active }: { active: string }) {
  const [locale, setLocale] = useInterfaceLocale();
  const location = useWorkspaceLocation();
  const returnTo = safeWorkspaceReturn(new URL(location, "https://workspace.invalid").searchParams.get("return_to"), "");
  return <GenesisNavigation locale={locale} location={location} active={active}
    onLanguage={() => setLocale(locale === "en" ? "ru" : "en")} returnTo={returnTo}/>;
}
