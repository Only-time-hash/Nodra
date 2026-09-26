"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  ShieldQuestion,
  X,
} from "lucide-react";
import { WorkspaceSidebar } from "../components/workspace-sidebar";

type Approval = {
  id: string;
  action: string | null;
  occurred_at: string;
  sequence_no: number;
  payload: any;
  agents: any;
  human_decision: {
    decision: string;
    reason: string;
    decided_at: string;
  } | null;
};

export default function ApprovalsPage() {
  const [items, setItems] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [review, setReview] = useState<{
    item: Approval;
    decision: "approved" | "denied";
  } | null>(null);
  const [reason, setReason] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/approvals", { cache: "no-store" });

    if (response.status === 401) {
      location.href = "/auth?intent=signin";
      return;
    }

    const json = await response.json();
    if (!response.ok) setError(json.error ?? "Could not load approvals");
    else {
      setItems(json.approvals ?? []);
      setError("");
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(
    () => ({
      pending: items.filter((x) => !x.human_decision).length,
      approved: items.filter((x) => x.human_decision?.decision === "approved").length,
      denied: items.filter((x) => x.human_decision?.decision === "denied").length,
    }),
    [items],
  );

  async function submit() {
    if (!review || reason.trim().length < 3) return;

    setBusy(review.item.id);
    setError("");

    const response = await fetch("/api/approvals/decision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: review.item.id,
        decision: review.decision,
        reason: reason.trim(),
      }),
    });

    const json = await response.json();
    setBusy("");

    if (!response.ok) {
      setError(json.error ?? "Could not record decision");
      return;
    }

    setReview(null);
    setReason("");
    await load();
  }

  return (
    <main className="lab">
      <WorkspaceSidebar active="Approvals" />

      <section className="labMain">
        <div className="commandTopbar">
          <label className="commandSearch">
            <span>⌕</span>
            <input placeholder="Search approvals..." readOnly />
          </label>
          <div className="topbarStatus">
            <span className="liveIndicator live"><i /> LIVE</span>
            <span>V0.1</span>
          </div>
        </div>

        <header className="labHeader">
          <div>
            <p>NODRA / APPROVALS</p>
            <h1>Approvals</h1>
            <p className="dashboardSub">
              Review high-impact actions that require explicit human authorization.
            </p>
          </div>
        </header>

        <div className="refMetricGrid approvalsReferenceMetrics">
          <article className="metricBlue">
            <ShieldQuestion />
            <div><b>{stats.pending}</b><span>Pending</span><small>Awaiting review</small></div>
          </article>
          <article className="metricGreen">
            <CheckCircle2 />
            <div><b>{stats.approved}</b><span>Approved</span><small>Audited decisions</small></div>
          </article>
          <article className="metricRed">
            <X />
            <div><b>{stats.denied}</b><span>Denied</span><small>Blocked by reviewer</small></div>
          </article>
          <article className="metricBlue">
            <ShieldCheck />
            <div><b>{items.length}</b><span>Evidence Records</span><small>Signed review events</small></div>
          </article>
        </div>

        {error ? <div className="credentialError">{error}</div> : null}

        <section className="refMainPanel approvalReferencePanel">
          <div className="refPanelTitle">
            <div>
              <h3>Authorization Requests</h3>
              <small>Actions requiring a human decision.</small>
            </div>
            <button className="referenceRefresh" type="button" onClick={() => void load()}>
              Refresh
            </button>
          </div>

          <div className="approvalReferenceTable">
            <div className="approvalReferenceRow head">
              <span>Agent</span>
              <span>Action</span>
              <span>Resource</span>
              <span>Time</span>
              <span>Status</span>
              <span>Decision</span>
            </div>

            {loading ? (
              <div className="refEmpty">Verifying authorization evidence…</div>
            ) : items.length === 0 ? (
              <div className="refEmpty approvalClear">
                <ShieldCheck />
                <strong>No pending approval requests</strong>
                <p>New signed requests that require review will appear here automatically.</p>
              </div>
            ) : (
              items.map((item) => (
                <div className="approvalReferenceRow" key={item.id}>
                  <span>
                    <b>{item.agents?.name || "Protected agent"}</b>
                    <small>#{item.sequence_no}</small>
                  </span>
                  <span><code>{item.action || "protected action"}</code></span>
                  <span>{String(item.payload?.resourceId || "resource")}</span>
                  <span>{new Date(item.occurred_at).toLocaleString()}</span>
                  <span>
                    <i className={item.human_decision ? "dot" : "dot active"} />
                    {item.human_decision?.decision || "pending"}
                  </span>
                  <span className="approvalReferenceActions">
                    {item.human_decision ? (
                      <small>{item.human_decision.reason}</small>
                    ) : (
                      <>
                        <button
                          disabled={busy === item.id}
                          onClick={() => {
                            setReason("");
                            setReview({ item, decision: "approved" });
                          }}
                        >
                          <Check /> Approve
                        </button>
                        <button
                          className="danger"
                          disabled={busy === item.id}
                          onClick={() => {
                            setReason("");
                            setReview({ item, decision: "denied" });
                          }}
                        >
                          <X /> Deny
                        </button>
                      </>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="referenceSecurityNotice">
          <ShieldCheck />
          <div>
            <b>Fail-closed by design</b>
            <p>
              Human decisions remain bound to the original authorization event and
              are retained as part of Nodra’s evidence trail.
            </p>
          </div>
        </aside>
      </section>

      {review ? (
        <div className="approvalModalBackdrop" onMouseDown={() => !busy && setReview(null)}>
          <div className="approvalModal" onMouseDown={(event) => event.stopPropagation()}>
            <div className={"approvalModalIcon " + review.decision}>
              {review.decision === "approved" ? <Check /> : <X />}
            </div>
            <span>HUMAN AUTHORIZATION</span>
            <h2>{review.decision === "approved" ? "Approve" : "Deny"} this protected action?</h2>
            <p>
              <b>{review.item.agents?.name || "Protected agent"}</b> requests{" "}
              <code>{review.item.action || "protected action"}</code>.
            </p>
            <label>
              Decision rationale
              <small>Required · minimum 3 characters</small>
              <textarea
                autoFocus
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why this action should be approved or denied…"
              />
            </label>
            <div className="approvalModalActions">
              <button className="secondary" disabled={!!busy} onClick={() => setReview(null)}>
                Cancel
              </button>
              <button
                className={review.decision === "denied" ? "danger" : ""}
                disabled={!!busy || reason.trim().length < 3}
                onClick={() => void submit()}
              >
                {busy
                  ? "Recording decision…"
                  : review.decision === "approved"
                    ? "Approve action"
                    : "Deny action"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
