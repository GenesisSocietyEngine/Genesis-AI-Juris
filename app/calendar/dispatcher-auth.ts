import { providerRequest } from "./provider-request";
const issuer = "https://token.actions.githubusercontent.com",
  repo = "GenesisSocietyEngine/Genesis-AI-Juris",
  audience = "https://casevant.pro/api/calendar/dispatch";
function decode(value: string) {
  const base = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base.padEnd(Math.ceil(base.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
}
export type AssertionStatus = "verified" | "missing" | "claims" | "issuer" | "signature";
export async function verifyAssertion(
  token: string,
  transport: typeof fetch = fetch,
  now = Date.now(),
): Promise<AssertionStatus> {
  let stage: AssertionStatus = "claims";
  try {
    if (!token || token.length > 12000) return "missing";
    const parts = token.split(".");
    if (parts.length !== 3) return "claims";
    const parse = (s: string) => JSON.parse(new TextDecoder().decode(decode(s)));
    const [h, p] = parts.slice(0, 2).map(parse);
    if (
      h.alg !== "RS256" ||
      typeof h.kid !== "string" ||
      p.iss !== issuer ||
      p.aud !== audience ||
      p.repository !== repo ||
      String(p.repository_id) !== "1311507341" ||
      String(p.repository_owner_id) !== "308170479" ||
      p.ref !== "refs/heads/main" ||
      p.workflow_ref !== repo + "/.github/workflows/calendar-delivery.yml@refs/heads/main" ||
      !["schedule", "workflow_dispatch"].includes(p.event_name) ||
      !Number.isFinite(p.exp) ||
      !Number.isFinite(p.nbf) ||
      p.exp <= now / 1000 ||
      p.nbf > now / 1000 + 30 ||
      p.exp - p.nbf > 900
    )
      return "claims";
    stage = "issuer";
    const res = await providerRequest(
      transport,
      issuer + "/.well-known/jwks",
      {
        headers: { Accept: "application/json", "User-Agent": "CaseVant calendar dispatcher" },
      },
      5000,
    );
    if (!res.ok) return "issuer";
    const jwks = (await res.json()) as { keys: (JsonWebKey & { kid: string })[] };
    const key = jwks.keys.find((k) => k.kid === h.kid && k.kty === "RSA" && k.use !== "enc");
    if (!key?.n || !key.e) return "issuer";
    stage = "signature";
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      { kty: "RSA", n: key.n, e: key.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return (await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      decode(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1]),
    ))
      ? "verified"
      : "signature";
  } catch {
    return stage;
  }
}

export async function authorized(token: string, transport: typeof fetch = fetch, now = Date.now()) {
  return (await verifyAssertion(token, transport, now)) === "verified";
}
