import {
  fields,
  reports,
  summarize,
  type Field,
  type Report,
  type Row,
} from "./model";
export type Config = {
  report: Report;
  columns: Field[];
  from: string;
  to: string;
  query: string;
  filter: Field | "";
  sort: Field;
  descending: boolean;
  group: Field | "";
  calculate: Field | "";
};
export type Saved = { id: string; name: string; config: Config };
export const defaults = (report: Report): Config => ({
  report,
  columns: [...reports[report].columns],
  from: "",
  to: "",
  query: "",
  filter: "",
  sort: reports[report].columns[0],
  descending: false,
  group: "",
  calculate: "",
});
export function validConfig(value: unknown): value is Config {
  if (!value || typeof value !== "object") return false;
  const c = value as Config;
  if (!Object.hasOwn(reports, c.report)) return false;
  const choices: Field[] = reports[c.report].columns;
  const date = (s: unknown) =>
    typeof s === "string" &&
    (!s ||
      (/^\d{4}-\d{2}-\d{2}$/.test(s) &&
        Number.isFinite(Date.parse(s)) &&
        new Date(s).toISOString().startsWith(s)));
  return (
    Array.isArray(c.columns) &&
    c.columns.length > 0 &&
    c.columns.every((f) => choices.includes(f)) &&
    new Set(c.columns).size === c.columns.length &&
    date(c.from) &&
    date(c.to) &&
    (!c.from || !c.to || c.from <= c.to) &&
    typeof c.query === "string" &&
    c.query.length <= 150 &&
    (!c.filter || choices.includes(c.filter)) &&
    choices.includes(c.sort) &&
    typeof c.descending === "boolean" &&
    (c.group === "" || choices.includes(c.group)) &&
    (c.calculate === "" ||
      (choices.includes(c.calculate) && numeric.includes(c.calculate)))
  );
}
export const numeric: Field[] = [
  "billed",
  "paid",
  "balance",
  "amount",
  "minutes",
  "expenses",
  "unbilled",
  "trust",
  "forecast",
  "count",
];
export function present(rows: Row[], config: Config, locale: string) {
  const matches = rows.filter(
    (r) =>
      !config.query ||
      (config.filter ? [r[config.filter] ?? ""] : Object.values(r)).some((v) =>
        String(v)
          .toLocaleLowerCase(locale)
          .includes(config.query.trim().toLocaleLowerCase(locale)),
      ),
  );
  const result = config.group
    ? summarize(
        matches,
        config.group,
        config.calculate ? [config.calculate] : [],
      )
    : [...matches];
  const sort = config.group || config.sort;
  result.sort((a, b) => {
    const x = a[sort],
      y = b[sort];
    const order =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x ?? "").localeCompare(String(y ?? ""), locale, {
            numeric: true,
          });
    return config.descending ? -order : order;
  });
  const columns: Field[] = config.group
    ? [
        ...new Set<Field>([
          config.group,
          "count",
          ...(config.calculate ? [config.calculate] : []),
        ]),
      ]
    : config.columns;
  const values = config.calculate
    ? matches
        .map((r) => r[config.calculate as Field])
        .filter((n): n is number => typeof n === "number")
    : [];
  return {
    rows: result,
    columns,
    total: values.length
      ? Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100
      : null,
  };
}
export function csv(rows: Row[], columns: Field[], language: 0 | 1) {
  const escape = (value: string | number | undefined) => {
    const raw = String(value ?? "");
    const safe =
      typeof value === "string" && /^\s*[=+@\-\t\r]/.test(raw)
        ? "'" + raw
        : raw;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  return [
    columns.map((k) => escape(fields[k][language])).join(","),
    ...rows.map((row) => columns.map((k) => escape(row[k])).join(",")),
  ].join("\r\n");
}
