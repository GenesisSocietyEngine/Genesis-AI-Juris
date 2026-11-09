const issuer = "https://token.actions.githubusercontent.com",
  repo = "GenesisSocietyEngine/Genesis-AI-Juris",
  audience = "https://casevant.pro/api/calendar/dispatch";
function decode(value: string) {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}
export async function authorized(token: string, transport: typeof fetch = fetch, now = Date.now()) {
  try {
    if (!token || token.length > 12000) return false;
    const parts = token.split(".");
    if (parts.length !== 3) return false;
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
      return false;
    const res = await transport(issuer + "/.well-known/jwks", {
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const jwks = (await res.json()) as { keys: (JsonWebKey & { kid: string })[] };
    const key = jwks.keys.find((k) => k.kid === h.kid && k.kty === "RSA" && k.use !== "enc");
    if (!key) return false;
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      key,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      decode(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1]),
    );
  } catch {
    return false;
  }
}
