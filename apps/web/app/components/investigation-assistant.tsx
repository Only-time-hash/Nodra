"use client";

import { useMemo, useState } from "react";

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          return String(record.name ?? record.label ?? record.event ?? record.detail ?? "");
        }
        return String(item ?? "");
      })
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function formatTimestamp(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function Timeline({ value }: { value: unknown }) {
  const rows = Array.isArray(value) ? value : [];
  if (!rows.length) return <p className="aiReportMuted">No timeline entries were returned.</p>;

  return (
    <div className="aiTimeline">
      {rows.map((item: any, index: number) => (
        <div className="aiTimelineRow" key={index}>
          <span className="aiTimelineMarker">{index + 1}</span>
          <div>
            <time>{formatTimestamp(item?.timestamp ?? item?.time ?? item?.at)}</time>
            <p>{String(item?.event ?? item?.detail ?? item?.description ?? "Recorded incident event")}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

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
      const reason =
        json.reason === "provider_temporarily_unavailable"
          ? "Gemini is temporarily overloaded. Nodra tried its configured fallback models too."
          : json.reason === "provider_quota_or_rate_limit"
            ? "Gemini quota or rate limit was reached. Try again shortly."
            : json.reason === "provider_key_or_access_denied"
              ? "Gemini rejected the API key or project access."
              : json.reason === "invalid_provider_request"
                ? "Gemini rejected the request format."
                : null;
      setMessage(reason ?? json.error ?? "Investigation assistance failed.");
      return;
    }

    setResult(json);
  }

  const analysis = result?.analysis ?? null;
  const evidenceGaps = asList(analysis?.evidenceGaps);
  const recommendedSteps = asList(analysis?.recommendedInvestigationSteps);
  const blastRadius = asList(analysis?.blastRadius);

  return (
    <section className="settingsPanel investigationAssistant">
      <div className="settingsPanelHead">
        <div>
          <h3>Investigation Assistant</h3>
          <p>
            Evidence-grounded incident analysis. AI can explain what happened, but Nodra keeps
            authorization, containment, recovery and restart decisions deterministic.
          </p>
        </div>
      </div>

      <div className="settingsFormRows">
        <label className="settingsField">
          <span>Incident</span>
          <select
            value={incidentId}
            onChange={(e) => setIncidentId(e.target.value)}
            disabled={!enabled || busy || !options.length}
          >
            {options.map((incident) => (
              <option key={incident.id} value={incident.id}>
                {incident.metadata?.source === "nodra-v0.1-lab" ? "[LAB] " : ""}
                {incident.title || incident.id} · {incident.severity || "unknown"} · {incident.state || "unknown"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button className="settingsSaveWide" disabled={!enabled || busy || !incidentId} onClick={() => void run()}>
        {busy ? "Analyzing evidence…" : "Analyze selected incident"}
      </button>

      {!enabled ? (
        <div className="settingsNotice">Enable AI Investigation Assistance above before running an analysis.</div>
      ) : null}
      {message ? <div className="settingsNotice">{message}</div> : null}

      {analysis ? (
        <div className="aiReport">
          <div className="aiTrustNotice">
            <div>
              <strong>AI-assisted analysis</strong>
              <span>Grounded in recorded Nodra evidence</span>
            </div>
            <small>Security decisions remain deterministic</small>
          </div>

          <section className="aiSummaryCard">
            <span className="aiSectionLabel">SUMMARY</span>
            <p>{String(analysis.summary ?? "No summary returned.")}</p>
          </section>

          <div className="aiReportGrid">
            <section className="aiReportCard aiTimelineCard">
              <div className="aiReportCardHead">
                <div>
                  <span className="aiSectionLabel">EVIDENCE TIMELINE</span>
                  <h4>Observed sequence</h4>
                </div>
                <b>{Array.isArray(analysis.timeline) ? analysis.timeline.length : 0} events</b>
              </div>
              <Timeline value={analysis.timeline} />
            </section>

            <section className="aiReportCard">
              <div className="aiReportCardHead">
                <div>
                  <span className="aiSectionLabel">LIKELY CAUSE</span>
                  <h4>AI hypothesis</h4>
                </div>
                <b className="aiHypothesisBadge">Hypothesis</b>
              </div>
              <p>{String(analysis.likelyCause ?? "No likely cause was inferred from the available evidence.")}</p>
              <small className="aiReportMuted">
                Treat this as an investigative hypothesis unless the evidence independently proves causation.
              </small>
            </section>

            <section className="aiReportCard">
              <div className="aiReportCardHead">
                <div>
                  <span className="aiSectionLabel">BLAST RADIUS</span>
                  <h4>Affected scope</h4>
                </div>
              </div>
              {blastRadius.length ? (
                <div className="aiChipList">
                  {blastRadius.map((item, index) => <span key={index}>{item}</span>)}
                </div>
              ) : (
                <p className="aiReportMuted">No blast-radius statement was returned.</p>
              )}
            </section>

            <section className="aiReportCard">
              <div className="aiReportCardHead">
                <div>
                  <span className="aiSectionLabel">EVIDENCE GAPS</span>
                  <h4>What is still unknown</h4>
                </div>
              </div>
              {evidenceGaps.length ? (
                <ul className="aiEvidenceList">
                  {evidenceGaps.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              ) : (
                <p className="aiReportMuted">No material evidence gaps were identified.</p>
              )}
            </section>

            <section className="aiReportCard aiStepsCard">
              <div className="aiReportCardHead">
                <div>
                  <span className="aiSectionLabel">NEXT INVESTIGATION STEPS</span>
                  <h4>Analyst follow-up</h4>
                </div>
              </div>
              {recommendedSteps.length ? (
                <ol className="aiStepsList">
                  {recommendedSteps.map((item, index) => <li key={index}>{item}</li>)}
                </ol>
              ) : (
                <p className="aiReportMuted">No additional investigative steps were recommended.</p>
              )}
            </section>
          </div>

          <details className="aiTechnicalDetails">
            <summary>Technical details</summary>
            <div>
              <span>Provider <b>{result.provider}</b></span>
              <span>Model <b>{result.model}</b></span>
              <span>Incident <b>{String(result.incidentId).slice(0, 8)}…</b></span>
              <span>Decision engine <b>Unaffected</b></span>
            </div>
          </details>
        </div>
      ) : null}
    </section>
  );
}
