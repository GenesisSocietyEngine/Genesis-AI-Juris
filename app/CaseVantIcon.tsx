import type { ReactNode } from "react";

/** Original CaseVant Line icons: 24-unit grid, open strokes, clipped case corners. */
const paths: Record<string, ReactNode> = {
    home: <><path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/></>,
    reminder: <><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 21h4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18M7 15h2m4 0h2m-8 3h2"/></>,
    flow: <><rect x="8" y="2" width="8" height="5" rx="1"/><rect x="2" y="17" width="7" height="5" rx="1"/><rect x="15" y="17" width="7" height="5" rx="1"/><path d="M12 7v5M5 17v-5h14v5"/></>,
    report: <><path d="M4 3h12l4 4v14H4Z"/><path d="M8 17v-4m4 4V9m4 8v-6"/></>,
    studio: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    cases: <><path d="M3 7V5h7l2 2h9v11l-3 3H3Z"/><path d="M7 12h10M7 16h6"/></>,
    demo: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4Z"/></>,
    template: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    tasks: <><path d="m3 6 2 2 4-4m3 2h9M3 13l2 2 4-4m3 2h9M5 20h16"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3v.1"/></>,
    plus: <path d="M12 4v16M4 12h16"/>,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    organization: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2m4 0h2M8 11h2m4 0h2m-6 6h4v4"/></>,
    people: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3"/></>,
    account: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    exit: <><path d="M9 3H3v18h6m5-15 6 6-6 6m-5-6h11"/></>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
    refresh: <><path d="M20 10a8 8 0 0 0-14-5L3 8m0-5v5h5M4 14a8 8 0 0 0 14 5l3-3m0 5v-5h-5"/></>,
    edit: <><path d="m4 15 11-11 5 5L9 20H4Zm9-9 5 5M4 20h16"/></>,
    save: <><path d="M4 3h13l4 4v14H3V3ZM7 3v6h9V3M7 21v-8h10v8"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    filter: <path d="M3 5h18l-7 8v6l-4 2v-8Z"/>,
    clear: <><path d="M3 5h15l-6 7v7l-3 2v-9ZM16 15l5 6m0-6-5 6"/></>,
    previous: <path d="m14 5-7 7 7 7"/>,
    next: <path d="m10 5 7 7-7 7"/>,
    today: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/><circle cx="12" cy="16" r="2"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/></>,
    check: <path d="m4 12 5 5L20 6"/>,
    archive: <><path d="M4 8v13h16V8M3 3h18v5H3ZM9 12h6"/></>,
    document: <><path d="M4 3h11l5 5v13H4ZM15 3v6h5M8 13h8M8 17h5"/></>,
    location: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>,
    grid: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M9 9v12m6-12v12M3 15h18"/></>,
    list: <path d="M8 5h13M8 12h13M8 19h13M3 5h1m-1 7h1m-1 7h1"/>,
};

export const CASEVANT_ICON_NAMES=Object.keys(paths);
export function WorkspaceIcon({name}:{name:string}){
 return <svg className="casevant-icon" data-icon={name} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]??paths.document}</svg>;
}
