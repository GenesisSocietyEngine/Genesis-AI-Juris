import type { CaseTypeId } from "./types";

export type ExampleLaunch = { id: CaseTypeId; phase: "loading" | "error"; context: string };

export default function ExampleLaunchStatus({ launch, locale, cancel, retry }: {
  launch: ExampleLaunch; locale: "en" | "ru"; cancel: () => void; retry: () => void;
}) {
  const en = locale === "en";
  return <div className="example-launch-status">
    <p role="status" aria-live="polite" aria-atomic="true">{launch.phase === "loading"
      ? en ? "Opening example… Your draft is unchanged until you confirm." : "Загрузка примера… Черновик не изменится до подтверждения."
      : en ? "The example could not load. Your draft is unchanged." : "Не удалось загрузить пример. Черновик не изменён."}</p>
    <button type="button" className="secondary-cta" onClick={launch.phase === "loading" ? cancel : retry}>{launch.phase === "loading" ? en ? "Cancel opening" : "Отменить загрузку" : en ? "Try again" : "Повторить"}</button>
  </div>;
}
