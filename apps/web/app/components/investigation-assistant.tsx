"use client";

import { useMemo, useState } from "react";

export function InvestigationAssistant({ incidents, enabled }: { incidents: any[]; enabled: boolean }) {
  const options = useMemo(() => (incidents ?? []).slice(0, 50), [incidents]);
  const [incidentId, setIncidentId] = useState(options[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState("");

  async function run() {
    if (!incidentId) return;
    setBusy(true);
    setMessage("");
    setResult(null);
    const res = await fetch("/api/investigations/assist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ incidentId }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(json.error ?? "Investigation assistance failed.");
      return;
    }
    setResult(json);
  }

  return (
    <section className="settingsPanel">
      <div className="settingsPanelHead">
        <div>
          <h3>Investigation Assistant</h3>
          <p>Grounded summaries from real incident evidence. AI never makes Nodra authorization, containment, recovery or restart decisions.</p>
        </div>
      </div>

      <div className="settingsFormRows">
        <label className="settingsField">
          <span>Incident</span>
          <select value={incidentId} onChange={(e) => setIncidentId(e.target.value)} disabled={!enabled || busy || !options.length}>
            {options.map((incident) => (
              <option key={incident.id} value={incident.id}>
                {incident.metadata?.source === "nodra-v0.1-lab" ? "[LAB] " : ""}{incident.title || incident.id} · {incident.severity || "unknown"} · {incident.state || "unknown"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button className="settingsSaveWide" disabled={!enabled || busy || !incidentId} onClick={() => void run()}>
        {busy ? "Analyzing evidence…" : "Analyze selected incident"}
      </button>

      {!enabled ? <div className="settingsNotice">Enable AI Investigation Assistance above before running an analysis.</div> : null}
      {message ? <div className="settingsNotice">{message}</div> : null}

      {result?.analysis ? (
        <div style={{marginTop:16,display:"grid",gap:12}}>
          <article className="settingsControlGrid">
            <div style={{padding:16}}>
              <b>Summary</b>
              <p>{String(result.analysis.summary ?? "No summary returned.")}</p>
            </div>
          </article>
          <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",background:"#071522",padding:16,borderRadius:12}}>
            {JSON.stringify(result.analysis, null, 2)}
          </pre>
          <small>Provider: {result.provider} · Model: {result.model} · Deterministic security decisions unaffected.</small>
        </div>
      ) : null}
    </section>
  );
}
