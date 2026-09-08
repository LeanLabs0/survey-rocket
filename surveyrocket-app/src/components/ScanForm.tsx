import { useState } from "react";

type Gap = {
  claim?: string;
  target_stat?: string;
  survey_name?: string;
  questions?: unknown[];
};

export default function ScanForm({ clientSlug }: { clientSlug: string }) {
  const [url, setUrl] = useState("");
  const [stat, setStat] = useState("");
  const [log, setLog] = useState("");
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setGaps([]);
    const started = Date.now();
    setLog("Reading the site… 0s");
    const tick = setInterval(() => {
      setLog(`Reading the page and checking each claim… ${Math.round((Date.now() - started) / 1000)}s. Most scans take under a minute.`);
    }, 1000);
    try {
      const res = await fetch("/api/app/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: clientSlug, url: url.trim(), target_stat: stat.trim() || undefined }),
      });
      const data = await res.json();
      clearInterval(tick);
      if (!res.ok || data.error) {
        setLog(data.error || "The scan could not finish. Wait a minute and try again.");
        return;
      }
      setLog(`Read the page in ${Math.round((Date.now() - started) / 1000)}s.`);
      setGaps(data.gaps || []);
    } catch {
      clearInterval(tick);
      setLog("The scan timed out. Wait a minute and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function useDraft(gap: Gap) {
    const res = await fetch("/api/app/scan", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client: clientSlug, gap }),
    });
    const data = await res.json();
    if (res.ok && data.survey?.id) {
      window.location.href = `/app/${clientSlug}/surveys/${data.survey.id}/edit`;
    }
  }

  return (
    <div className="scan-grid">
      <div className="scan-card">
        <h3>Point the scan at a page</h3>
        <label htmlFor="scan-url">The page to scan</label>
        <input id="scan-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.yourcompany.com/customers" />
        <div className="scan-note">We read this one page. Point it at a page that makes claims, like your homepage or a case study.</div>
        <label htmlFor="scan-stat">The stat you want to publish (optional)</label>
        <input id="scan-stat" value={stat} onChange={(e) => setStat(e.target.value)} placeholder="__% of customers see results in the first 90 days" />
        <div className="scan-actions">
          <button className="btn primary" disabled={busy} onClick={run}>Scan this page</button>
        </div>
        {log && <div className="scan-log" style={{ display: "block" }}><div>{log}</div></div>}
      </div>
      {gaps.length > 0 && (
        <div className="scan-card">
          <h3>What the scan found</h3>
          {gaps.map((g, i) => (
            <div key={i} style={{ borderTop: "1px solid var(--line)", padding: "14px 0" }}>
              <div style={{ fontSize: 13, color: "var(--tx-2)", marginBottom: 6 }}>Claim: “{g.claim || ""}”</div>
              <div style={{ fontSize: 13.5, marginBottom: 8 }}>Target stat: {g.target_stat || ""}</div>
              <div style={{ fontSize: 12, color: "var(--tx-dis)", marginBottom: 10 }}>{(g.questions || []).length} drafted question{(g.questions || []).length === 1 ? "" : "s"}</div>
              <button className="btn primary small" onClick={() => useDraft(g)}>Use this draft in the editor</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
