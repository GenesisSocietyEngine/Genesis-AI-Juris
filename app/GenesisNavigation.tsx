"use client";

import LegacyGenesisNavigation, { type GenesisNavigationProps } from "./LegacyGenesisNavigation";

export { WORKSPACE_PAGES, WorkspaceIcon } from "./LegacyGenesisNavigation";

// Keep the existing caller contract while every page shares the same
// session-aware, expandable navigation and workspace departure controls.
export default function GenesisNavigation(props: GenesisNavigationProps & { expandable?: boolean }) {
  return <LegacyGenesisNavigation {...props}/>;
}
