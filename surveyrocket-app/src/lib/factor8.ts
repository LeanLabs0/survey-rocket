const base = () =>
  (process.env.FACTOR8_API_URL || "https://factor8-agent-sdk.fly.dev/api/v1/public/survey-rocket").replace(
    /\/$/,
    "",
  );

function headers() {
  const key = process.env.FACTOR8_SERVICE_KEY || "";
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (key) h["X-SR-Admin-Key"] = key;
  return h;
}

export async function factor8Turn(body: unknown) {
  const res = await fetch(`${base()}/turn`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { degraded: true };
  }
  return { ok: res.ok, status: res.status, data };
}

export async function factor8Scan(body: { url: string; single_page?: boolean; target_stat?: string }) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 90_000);
  try {
    const res = await fetch(`${base()}/scan`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const data = await res.json().catch(() => ({ error: "scan_failed" }));
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}
