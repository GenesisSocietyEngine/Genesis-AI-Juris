export type AppView = "library" | "demos" | "play" | "studio" | "community" | "help";
type EntryParams = Record<string, string | string[] | undefined>;

/** Explicit routes and continuations take precedence over the normal Studio entry. */
export function studioEntry(params: EntryParams, fallback: AppView = "studio") {
  const requested = params.view;
  const initialView: AppView = requested === "library" || requested === "demos" || requested === "studio"
    || requested === "play" || requested === "community" || requested === "help" ? requested : fallback;
  const autoStartCanopy = false;
  return { initialView, autoStartCanopy };
}
