"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  EyeOff,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { WorkspaceSidebar } from "../components/workspace-sidebar";

type Credential = {
  id: string;
  agent_id: string;
  agent_external_id?: string;
  agent_name?: string;
  label: string;
  secret_prefix: string;
  status: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export default function CredentialsPage() {
  const [items, setItems] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    const response = await fetch("/api/integrations/credentials", { cache: "no-store" });

    if (response.status === 401) {
      location.href = "/auth?intent=signin";
      return;
    }

    const json = await response.json();

    if (!response.ok) setError(json.error ?? "Could not load credentials");
    else setItems(json.credentials ?? []);

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function rotate(id: string) {
    setBusy(id);
    setError("");

    const response = await fetch("/api/integrations/credentials", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credentialId: id }),
    });

    const json = await response.json();
    setBusy(null);

    if (!response.ok) {
      setError(json.error ?? "Credential rotation failed");
      return;
    }

    setSecret(json.secret);
    await load();
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this credential? The connected agent will no longer authenticate with it.")) {
      return;
    }

    setBusy(id);
    setError("");

    const response = await fetch("/api/integrations/credentials", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credentialId: id }),
    });

    const json = await response.json();
    setBusy(null);

    if (!response.ok) {
      setError(json.error ?? "Credential revocation failed");
      return;
    }

    await load();
  }

  const stats = useMemo(
    () => ({
      active: items.filter((x) => x.status === "active").length,
      used: items.filter((x) => x.last_used_at).length,
      revoked: items.filter((x) => x.status !== "active").length,
      total: items.length,
    }),
    [items],
  );

  return (
    <main className="lab">
      <WorkspaceSidebar active="Credentials" />

      <section className="labMain">
        <div className="commandTopbar">
          <label className="commandSearch">
            <span>⌕</span>
            <input placeholder="Search credentials..." readOnly />
          </label>
          <div className="topbarStatus">
            <span className="liveIndicator live"><i /> LIVE</span>
            <span>V0.1</span>
          </div>
        </div>

        <header className="labHeader">
          <div>
            <p>NODRA / CREDENTIALS</p>
            <h1>Credentials</h1>
            <p className="dashboardSub">
              Manage server-side integration identities for protected agents.
            </p>
          </div>
          <div className="headerActions">
            <Link className="ghostBtn addAgentBtn" href="/onboarding/welcome">
              + Create Credential
            </Link>
          </div>
        </header>

        <div className="refMetricGrid">
          <article className="metricGreen">
            <KeyRound />
            <div><b>{stats.active}</b><span>Active</span><small>Usable credentials</small></div>
          </article>
          <article className="metricBlue">
            <RefreshCw />
            <div><b>{stats.used}</b><span>Runtime Used</span><small>Seen by gateway</small></div>
          </article>
          <article className="metricRed">
            <Trash2 />
            <div><b>{stats.revoked}</b><span>Revoked</span><small>No longer accepted</small></div>
          </article>
          <article className="metricBlue">
            <ShieldCheck />
            <div><b>{stats.total}</b><span>Total</span><small>Workspace identities</small></div>
          </article>
        </div>

        {secret ? (
          <div className="credentialReveal referenceCredentialReveal">
            <ShieldCheck />
            <div>
              <strong>Rotated secret — shown once</strong>
              <p>Store this server-side now. Nodra will not return it again.</p>
              <code>{secret}</code>
            </div>
            <button onClick={() => navigator.clipboard.writeText(secret)}>
              <Copy /> Copy
            </button>
            <button onClick={() => setSecret("")}>
              <Check /> Stored
            </button>
          </div>
        ) : null}

        {error ? <div className="credentialError">{error}</div> : null}

        <section className="refMainPanel credentialReferencePanel">
          <div className="refPanelTitle">
            <div>
              <h3>Runtime Credentials</h3>
              <small>Secret metadata only. Plaintext is never recoverable after issuance.</small>
            </div>
            <button className="referenceRefresh" type="button" onClick={() => void load()}>
              Refresh
            </button>
          </div>

          <div className="credentialReferenceTable">
            <div className="credentialReferenceRow head">
              <span>Credential</span>
              <span>Agent</span>
              <span>Created</span>
              <span>Last Used</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {loading ? (
              <div className="refEmpty">Loading credentials…</div>
            ) : items.length === 0 ? (
              <div className="refEmpty credentialReferenceEmpty">
                <KeyRound />
                <strong>No integration credentials yet</strong>
                <p>Protect an agent to issue its first server-side credential.</p>
                <Link href="/onboarding/welcome">Protect Agent</Link>
              </div>
            ) : (
              items.map((item) => (
                <div className="credentialReferenceRow" key={item.id}>
                  <span>
                    <b>{item.label}</b>
                    <small>{item.secret_prefix}••••••••</small>
                  </span>
                  <span><b>{item.agent_name || "Protected agent"}</b><small>{item.agent_external_id || item.agent_id}</small></span>
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  <span>
                    {item.last_used_at
                      ? new Date(item.last_used_at).toLocaleString()
                      : "Never"}
                  </span>
                  <span>
                    <i className={item.status === "active" ? "dot" : "dot active"} />
                    {item.status}
                  </span>
                  <span className="credentialReferenceActions">
                    {item.status === "active" ? (
                      <>
                        <button disabled={busy === item.id} onClick={() => void rotate(item.id)}>
                          <RefreshCw /> Rotate
                        </button>
                        <button
                          className="danger"
                          disabled={busy === item.id}
                          onClick={() => void revoke(item.id)}
                        >
                          <Trash2 /> Revoke
                        </button>
                      </>
                    ) : (
                      <small>Revoked</small>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="referenceSecurityNotice">
          <EyeOff />
          <div>
            <b>Credential safety</b>
            <p>
              Nodra stores only one-way hashes of integration secrets. Plaintext is
              returned only at issuance or rotation and should remain server-side.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
