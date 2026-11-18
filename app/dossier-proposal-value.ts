import type { JsonValue } from "./dossier-contract";

function boundedStatement(value: unknown): string {
  if (typeof value !== "string" || value.includes("\u0000")) throw new Error("accepted assertion statement is invalid.");
  const statement = value.trim();
  if (statement.length < 1 || statement.length > 20_000) throw new Error("accepted assertion statement is invalid.");
  return statement;
}

/** Accept the generated v1 envelope and legacy manual statements, never arbitrary fields. */
export function assertionStatement(value: JsonValue) {
  if (typeof value === "string") {
    return boundedStatement(value);
  }
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Accepted assertion proposals require a statement.");
  }
  const keys = Object.keys(value).sort();
  const legacy = keys.length === 1 && keys[0] === "statement";
  const versioned = keys.length === 2 && keys[0] === "schema_version" && keys[1] === "statement";
  if (!legacy && !versioned) {
    throw new Error("Accepted assertion proposals require exactly one statement field and optional schema_version.");
  }
  if (versioned && value.schema_version !== 1) {
    throw new Error("The assertion proposal schema version is unsupported.");
  }
  return boundedStatement(value.statement);
}
