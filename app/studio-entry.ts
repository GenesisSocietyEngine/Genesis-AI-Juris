export type AppView = "library" | "demos" | "play" | "studio" | "community" | "help";
type EntryParams = Record<string, string | string[] | undefined>;

/** Explicit routes and continuations take precedence over the starter demo. */
export function studioEntry(params: EntryParams, fallback: AppView = "studio") {
  const requested = params.view;
  const initialView: AppView = requested === "library" || requested === "demos" || requested === "studio"
    || requested === "community" || requested === "help" ? requested : fallback;
  const autoStartCanopy = initialView === "studio"
    && !["studio_step", "example", "import", "auth_continue", "dossier", "return_to"].some((key) => params[key]);
  return { initialView, autoStartCanopy };
}
