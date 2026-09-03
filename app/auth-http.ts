export function authJson(body: unknown, status = 200, setCookie?: string) {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    Pragma: "no-cache",
  });
  if (setCookie) headers.set("Set-Cookie", setCookie);
  return Response.json(body, { status, headers });
}

export const INVALID_LOGIN_MESSAGE = "Invalid email or password.";
export const INVALID_RECOVERY_MESSAGE = "The recovery credentials are invalid or expired.";
