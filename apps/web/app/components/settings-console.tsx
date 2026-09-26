"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Database,
  Download,
  FileClock,
  KeyRound,
  Link2,
  LockKeyhole,
  Network,
  Save,
  Settings2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCog,
  Users,
  WandSparkles,
} from "lucide-react";
import { ExternalNotifications } from "./external-notifications";
import { InvestigationAssistant } from "./investigation-assistant";

type SettingsData = {
  workspace: { id: string; name: string; slug: string; created_at: string; updated_at: string } | null;
  role: string;
  userId: string;
  settings: any;
  members: Array<{
    user_id: string;
    email: string;
    display_name: string;
    role: string;
    joined_at: string;
  }>;
  canManage: boolean;
  canDelete: boolean;
};

const tabs = [
  ["general", "General", Settings2],
  ["security", "Security", Shield],
  ["ai", "AI", BrainCircuit],
  ["agents", "Agent Controls", Bot],
  ["approvals", "Approval Policies", ClipboardCheck],
  ["integrations", "Integrations", Link2],
  ["notifications", "Notifications", Bell],
  ["evidence", "Evidence & Retention", FileClock],
] as const;

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={"settingsToggle " + (checked ? "on" : "")}
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="settingsField">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function SettingsConsole({ overview }: { overview: any }) {
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("general");
  const [data, setData] = useState<SettingsData | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const membersRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    setBusy("load");
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (res.status === 401) {
      location.href = "/auth?intent=signin";
      return;
    }
    const json = await res.json();
    setBusy("");
    if (!res.ok) {
      setMessage(json.error ?? "Could not load settings");
      return;
    }
    setData(json);
    setWorkspaceName(json.workspace?.name ?? "");
    setForm(json.settings ?? {});
    setMessage("");
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSettings(nextForm = form, includeWorkspace = false) {
    if (!data || !nextForm) return;
    setBusy("save");
    setMessage("");

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(includeWorkspace ? { workspaceName } : {}),
        settings: nextForm,
      }),
    });

    const json = await res.json();
    setBusy("");
    if (!res.ok) {
      setMessage(json.error ?? "Could not save settings");
      return;
    }

    setForm((current: any) => ({ ...current, ...json.settings }));
    setMessage("Saved");
    if (includeWorkspace) await load();
  }

  function update(path: string, value: unknown) {
    setForm((current: any) => ({ ...current, [path]: value }));
  }

  function updateNested(group: string, key: string, value: unknown) {
    setForm((current: any) => ({
      ...current,
      [group]: { ...(current?.[group] ?? {}), [key]: value },
    }));
  }

  async function updateMember(userId: string, role: string) {
    setBusy("member:" + userId);
    setMessage("");
    const res = await fetch("/api/settings/members", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    const json = await res.json();
    setBusy("");
    if (!res.ok) {
      setMessage(json.error ?? "Could not update member");
      return;
    }
    await load();
    setMessage("Member role updated");
  }

  async function removeMember(userId: string, name: string) {
    if (!confirm(`Remove ${name} from this workspace?`)) return;
    setBusy("member:" + userId);
    const res = await fetch("/api/settings/members", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    setBusy("");
    if (!res.ok) {
      setMessage(json.error ?? "Could not remove member");
      return;
    }
    await load();
  }

  async function deleteWorkspace() {
    if (!data?.workspace) return;
    const confirmation = prompt(
      `This permanently deletes the workspace and its Nodra data. Type "${data.workspace.name}" to confirm.`,
    );
    if (confirmation !== data.workspace.name) return;

    setBusy("delete");
    const res = await fetch("/api/settings", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    const json = await res.json();
    setBusy("");
    if (!res.ok) {
      setMessage(json.error ?? "Workspace deletion failed");
      return;
    }
    location.href = "/onboarding";
  }

  if (!data || !form) {
    return <div className="settingsExactLoading">{message || "Loading workspace settings…"}</div>;
  }

  const agents = overview?.agents ?? [];
  const events = overview?.events ?? [];
  const policies = overview?.policies ?? [];
  const activeAgents = agents.filter((agent: any) => agent.status === "healthy").length;
  const canEdit = data.canManage;
  const notificationItems = [
    ...(Boolean(form.notifications?.incidentAlerts)
      ? (overview?.incidents ?? [])
          .filter((incident: any) => incident.state !== "resolved")
          .map((incident: any) => ({
            key: "incident:" + incident.id,
            type: "Incident",
            title: incident.title ?? "Security incident",
            detail: String(incident.severity ?? "security") + " · " + String(incident.state),
            at: incident.opened_at,
          }))
      : []),
    ...(Boolean(form.notifications?.denialAlerts)
      ? events
          .filter((event: any) => event.decision === "deny")
          .map((event: any) => ({
            key: "denial:" + event.id,
            type: "Denied",
            title: event.action ?? event.event_type ?? "Denied action",
            detail: event.agents?.name ?? "Protected agent",
            at: event.occurred_at,
          }))
      : []),
    ...(Boolean(form.notifications?.recoveryAlerts)
      ? events
          .filter((event: any) =>
            ["contain", "recovery", "restart", "remediation"].some((token) =>
              String(event.action ?? event.event_type ?? "").toLowerCase().includes(token),
            ),
          )
          .map((event: any) => ({
            key: "recovery:" + event.id,
            type: "Recovery",
            title: event.action ?? event.event_type ?? "Recovery event",
            detail: event.agents?.name ?? "Nodra",
            at: event.occurred_at,
          }))
      : []),
  ]
    .sort((a: any, b: any) => String(b.at ?? "").localeCompare(String(a.at ?? "")))
    .slice(0, 8);

  return (
    <div className="settingsExact">
      <header className="settingsExactHeader">
        <div>
          <h1>Settings</h1>
          <p>Configure your workspace, security policies, agent controls, integrations and platform preferences.</p>
        </div>
      </header>

      <nav className="settingsExactTabs">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {message ? <div className={"settingsNotice " + (message === "Saved" || message.includes("updated") ? "ok" : "")}>{message}</div> : null}

      {tab === "general" ? (
        <>
          <div className="settingsTopGrid">
            <section className="settingsPanel workspaceInfoPanel">
              <div className="settingsPanelHead">
                <span><Settings2 /></span>
                <div><h3>Workspace Information</h3><p>Manage your organization’s Nodra workspace.</p></div>
              </div>

              <div className="workspaceInfoGrid">
                <Field label="Workspace Name">
                  <input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} disabled={!data.canDelete} />
                </Field>
                <Field label="Workspace ID">
                  <div className="copyField"><input value={data.workspace?.id ?? ""} readOnly /><button onClick={() => navigator.clipboard.writeText(data.workspace?.id ?? "")}><Copy /></button></div>
                </Field>
                <Field label="Display Name">
                  <input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} disabled={!data.canDelete} />
                </Field>
                <Field label="Created">
                  <input value={data.workspace?.created_at ? new Date(data.workspace.created_at).toLocaleString() : "—"} readOnly />
                </Field>
                <Field label="Description">
                  <textarea value={form.description ?? ""} maxLength={500} onChange={(e) => update("description", e.target.value)} disabled={!canEdit} />
                  <small className="charCount">{String(form.description ?? "").length}/500</small>
                </Field>
                <div className="workspaceFacts">
                  <span><small>Workspace Role</small><b>{data.role}</b></span>
                  <span><small>Protected Agents</small><b>{agents.length}</b></span>
                </div>
              </div>

              <div className="settingsPanelActions">
                <button className="primary" disabled={!canEdit || busy === "save"} onClick={() => void saveSettings(form, true)}>
                  <Save /> {busy === "save" ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </section>

            <section className="settingsPanel workspaceMembersPanel" ref={membersRef}>
              <div className="settingsPanelHead">
                <span><Users /></span>
                <div><h3>Workspace Members</h3><p>Manage access and roles in this workspace.</p></div>
                <button className="outlineSmall" onClick={() => membersRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}><UserCog /> Manage Members</button>
              </div>

              <div className="settingsMemberList">
                {data.members.map((member) => {
                  const initials = (member.display_name || member.email || "?")
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  const isOwner = member.role === "owner";
                  return (
                    <article key={member.user_id}>
                      <span className="memberAvatar">{initials}</span>
                      <div className="memberIdentity">
                        <b>{member.display_name || "Workspace member"}</b>
                        <small>{member.email}</small>
                      </div>
                      {data.canDelete && !isOwner ? (
                        <select value={member.role} disabled={busy === "member:" + member.user_id} onChange={(e) => void updateMember(member.user_id, e.target.value)}>
                          <option value="admin">Administrator</option>
                          <option value="analyst">Security Analyst</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <em className={"memberRole " + member.role}>{member.role}</em>
                      )}
                      <span className="memberActive"><i /> Active</span>
                      {data.canDelete && !isOwner ? <button className="memberRemove" onClick={() => void removeMember(member.user_id, member.display_name || member.email)}><Trash2 /></button> : <span />}
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="settingsMidGrid">
            <section className="settingsPanel">
              <div className="settingsPanelHead">
                <span><SlidersHorizontal /></span>
                <div><h3>Platform Configuration</h3><p>Configure platform behavior and workspace defaults.</p></div>
              </div>
              <div className="settingsFormRows">
                <Field label="Default Agent Health Threshold">
                  <div className="compoundInput">
                    <select value="custom" disabled><option>Custom</option></select>
                    <input type="number" min={1} max={1440} value={form.agent_health_threshold_minutes} onChange={(e) => update("agent_health_threshold_minutes", Number(e.target.value))} disabled={!canEdit} />
                    <span>minutes</span>
                  </div>
                </Field>
                <Field label="Event Retention Period">
                  <div className="compoundInput">
                    <select value="custom" disabled><option>Custom</option></select>
                    <input type="number" min={1} max={3650} value={form.event_retention_days} onChange={(e) => update("event_retention_days", Number(e.target.value))} disabled={!canEdit} />
                    <span>days</span>
                  </div>
                </Field>
                <Field label="Default Timezone">
                  <select value={form.default_timezone} onChange={(e) => update("default_timezone", e.target.value)} disabled={!canEdit}>
                    <option value="UTC">UTC</option>
                    <option value="Asia/Kolkata">Asia/Kolkata</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="Europe/London">Europe/London</option>
                  </select>
                </Field>
                <Field label="Date Format">
                  <select value={form.date_format} onChange={(e) => update("date_format", e.target.value)} disabled={!canEdit}>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  </select>
                </Field>
                <Field label="Theme Preference">
                  <select value={form.theme} onChange={(e) => update("theme", e.target.value)} disabled={!canEdit}>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select>
                </Field>
              </div>
            </section>

            <section className="settingsPanel">
              <div className="settingsPanelHead">
                <span><ShieldCheck /></span>
                <div><h3>Security Configuration</h3><p>Manage authentication and access controls.</p></div>
              </div>
              <div className="securitySettingList">
                <article>
                  <div><b>Multi-Factor Authentication (MFA)</b><small>When required, protected Nodra console routes demand a Supabase AAL2 session. Members are redirected to TOTP enrollment/challenge before access continues.</small><Link className="outlineSmall" href="/auth/mfa?next=/settings">Configure MFA</Link></div>
                  <Toggle checked={Boolean(form.require_mfa)} onChange={(v) => update("require_mfa", v)} disabled={!canEdit} />
                </article>
                <article>
                  <div style={{flex:1}}><b>IP Restrictions</b><small>Fail-closed CIDR/IP allow-list enforced at the protected Nodra request boundary.</small><textarea rows={3} placeholder={"203.0.113.10\n198.51.100.0/24"} value={(form.ip_allowlist ?? []).join("\n")} onChange={(e) => update("ip_allowlist", e.target.value.split(/\n|,/).map((v) => v.trim()).filter(Boolean))} disabled={!canEdit} /></div>
                  <Toggle checked={Boolean(form.ip_restrictions)} onChange={(v) => update("ip_restrictions", v)} disabled={!canEdit || !(form.ip_allowlist ?? []).length} />
                </article>
                <article>
                  <div><b>Session Timeout</b><small>Enforced inactivity window for authenticated Nodra console sessions.</small></div>
                  <select value={form.session_timeout_minutes} onChange={(e) => update("session_timeout_minutes", Number(e.target.value))} disabled={!canEdit}>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={240}>4 hours</option>
                  </select>
                </article>
                <article>
                  <div><b>Password Attack Surface</b><small>Nodra currently authenticates workspace users through GitHub OAuth and does not accept or store workspace passwords. Password strength therefore remains the identity provider's responsibility until password auth is introduced.</small></div>
                  <em>OAUTH ONLY</em>
                </article>
                <article>
                  <div><b>Allow API Access</b><small>When disabled, Nodra rejects protected-agent gateway access for this workspace.</small></div>
                  <Toggle checked={Boolean(form.allow_api_access)} onChange={(v) => update("allow_api_access", v)} disabled={!canEdit} />
                </article>
              </div>
            </section>
          </div>

          <div className="settingsBottomGrid">
            <section className="settingsPanel dangerPanel">
              <div className="settingsPanelHead">
                <span><AlertTriangle /></span>
                <div><h3>Danger Zone</h3><p>These actions are permanent and cannot be undone.</p></div>
              </div>
              <article>
                <div><b>Delete Workspace</b><small>Permanently delete this workspace and all associated Nodra data.</small></div>
                <button className="dangerButton" disabled={!data.canDelete || busy === "delete"} onClick={() => void deleteWorkspace()}><Trash2 /> Delete Workspace</button>
              </article>
              <article>
                <div><b>Export Workspace Data</b><small>Download a complete JSON export without plaintext credential secrets.</small></div>
                <a className="exportButton" href="/api/settings/export"><Download /> Export Data</a>
              </article>
            </section>

            <section className="settingsPanel workspaceStatusPanel">
              <div className="settingsPanelHead">
                <span><Activity /></span>
                <div><h3>Workspace Status</h3><p>Current runtime and usage overview.</p></div>
              </div>
              <div className="workspaceStatusGrid">
                <span><small>Role</small><b>{data.role}</b></span>
                <span><small>Total Agents</small><b>{agents.length}</b></span>
                <span><small>Active Agents</small><b>{activeAgents}</b></span>
                <span><small>Members</small><b>{data.members.length}</b></span>
                <span><small>Security Events</small><b>{events.length}</b></span>
                <span><small>Retention</small><b>{form.event_retention_days} days</b></span>
              </div>
            </section>

            <section className="settingsPanel quickActionsPanel">
              <div className="settingsPanelHead">
                <span><WandSparkles /></span>
                <div><h3>Quick Actions</h3><p>Common workspace actions.</p></div>
              </div>
              <Link href="/agents"><Users /><span>Manage Agents<small>Inspect protected runtime identities</small></span><ChevronRight /></Link>
              <Link href="/policies"><Shield /><span>Configure Security Policies<small>Set authorization behavior</small></span><ChevronRight /></Link>
              <Link href="/integrations"><Link2 /><span>Manage Integrations<small>Connect runtimes and APIs</small></span><ChevronRight /></Link>
              <Link href="/activity"><FileClock /><span>View Evidence Settings<small>Review security evidence</small></span><ChevronRight /></Link>
            </section>
          </div>
        </>
      ) : null}

      {tab === "security" ? (
        <section className="settingsTabPanel">
          <div className="settingsTabHero"><Shield /><div><h2>Security</h2><p>Workspace security controls and Nodra enforcement state.</p></div></div>
          <div className="settingsControlGrid">
            <article><ShieldCheck /><div><b>Fail-Closed Authorization</b><small>Nodra denies unsupported authority instead of silently permitting it.</small></div><em>ENFORCED</em></article>
            <article><LockKeyhole /><div><b>Tamper-Evident Evidence</b><small>Security events remain sequence-bound and hash verified.</small></div><em>{overview?.integrity?.valid ? "VERIFIED" : "CHECK"}</em></article>
            <article><Network /><div><b>Integration API Access</b><small>Controls whether registered agents may use the protected gateway.</small></div><Toggle checked={Boolean(form.allow_api_access)} onChange={(v) => update("allow_api_access", v)} disabled={!canEdit} /></article>
            <article><KeyRound /><div><b>Strong Credential Boundary</b><small>Plaintext credentials are never stored after issuance or rotation.</small></div><em>ENFORCED</em></article>
          </div>
          <button className="settingsSaveWide" disabled={!canEdit || busy === "save"} onClick={() => void saveSettings()}><Save /> Save Security Settings</button>
        </section>
      ) : null}

      {tab === "ai" ? (
        <section className="settingsTabPanel">
          <div className="settingsTabHero"><BrainCircuit /><div><h2>AI Configuration</h2><p>Preferences for AI-assisted investigation inside the Nodra console. These do not bypass deterministic security enforcement.</p></div></div>
          <div className="settingsControlGrid">
            <article><WandSparkles /><div><b>AI Investigation Assistance</b><small>Persist whether AI-assisted forensic summaries should be enabled when an AI provider is connected.</small></div><Toggle checked={Boolean(form.ai_config?.investigationAssist)} onChange={(v) => updateNested("ai_config", "investigationAssist", v)} disabled={!canEdit} /></article>
            <article><Shield /><div><b>Security Decisions</b><small>Authorization decisions remain deterministic and policy-based regardless of this preference.</small></div><em>DETERMINISTIC</em></article>
          </div>
          <button className="settingsSaveWide" disabled={!canEdit || busy === "save"} onClick={() => void saveSettings()}><Save /> Save AI Preferences</button>
          <InvestigationAssistant incidents={overview?.allIncidents ?? overview?.incidents ?? []} enabled={Boolean(form.ai_config?.investigationAssist)} />
        </section>
      ) : null}

      {tab === "agents" ? (
        <section className="settingsTabPanel">
          <div className="settingsTabHero"><Bot /><div><h2>Agent Controls</h2><p>Default operating thresholds for protected agents in this workspace.</p></div></div>
          <div className="settingsControlGrid">
            <article><Activity /><div><b>Health Threshold</b><small>Minutes without runtime activity before a healthy agent is shown as offline.</small></div><input className="miniNumber" type="number" min={1} max={1440} value={form.agent_health_threshold_minutes} onChange={(e) => update("agent_health_threshold_minutes", Number(e.target.value))} disabled={!canEdit} /></article>
            <article><ShieldCheck /><div><b>Default Pause on Critical Incident</b><small>When enabled, a real critical incident automatically pauses its real origin agent and records evidence.</small></div><Toggle checked={Boolean(form.agent_controls?.pauseOnCritical)} onChange={(v) => updateNested("agent_controls", "pauseOnCritical", v)} disabled={!canEdit} /></article>
          </div>
          <div className="settingsRelated"><span>{agents.length} registered protected agent{agents.length === 1 ? "" : "s"}</span><Link href="/agents">Manage Agents <ChevronRight /></Link></div>
          <button className="settingsSaveWide" disabled={!canEdit || busy === "save"} onClick={() => void saveSettings()}><Save /> Save Agent Controls</button>
        </section>
      ) : null}

      {tab === "approvals" ? (
        <section className="settingsTabPanel">
          <div className="settingsTabHero"><ClipboardCheck /><div><h2>Approval Policies</h2><p>Configure workspace preferences for human authorization workflows.</p></div></div>
          <div className="settingsControlGrid">
            <article><ClipboardCheck /><div><b>Require rationale</b><small>Reviewers must provide a reason before Approve or Deny.</small></div><em>ENFORCED</em></article>
            <article><FileClock /><div><b>Execution Token Lifetime</b><small>Approved execution tokens expire after five minutes and are one-time use.</small></div><em>5 MINUTES</em></article>
            <article><Shield /><div><b>Default High-Impact Review</b><small>When enabled, high-impact actions such as payments, bank operations, credential changes, exports and destructive system actions are escalated to human approval.</small></div><Toggle checked={Boolean(form.approval_policies?.highImpactReview)} onChange={(v) => updateNested("approval_policies", "highImpactReview", v)} disabled={!canEdit} /></article>
            <article><CheckCircle2 /><div><b>Configured Policies</b><small>Real runtime authorization policies in this workspace.</small></div><em>{policies.length}</em></article>
          </div>
          <div className="settingsRelated"><Link href="/approvals">Open Approval Queue <ChevronRight /></Link><Link href="/policies">Manage Policies <ChevronRight /></Link></div>
          <button className="settingsSaveWide" disabled={!canEdit || busy === "save"} onClick={() => void saveSettings()}><Save /> Save Approval Preferences</button>
        </section>
      ) : null}

      {tab === "integrations" ? (
        <section className="settingsTabPanel">
          <div className="settingsTabHero"><Link2 /><div><h2>Integrations</h2><p>Connected Nodra services and protected runtime entry points.</p></div></div>
          <div className="settingsControlGrid">
            <article><Network /><div><b>Protected Agent Gateway</b><small>{agents.length} registered customer agent{agents.length === 1 ? "" : "s"}.</small></div><em>{form.allow_api_access ? "ACTIVE" : "DISABLED"}</em></article>
            <article><Database /><div><b>Supabase Evidence Store</b><small>{overview?.integrity?.checkedEvents ?? events.length} evidence events checked.</small></div><em>{overview?.integrity?.valid ? "VERIFIED" : "CHECK"}</em></article>
          </div>
          <div className="settingsRelated"><Link href="/integrations">Open Integrations <ChevronRight /></Link><Link href="/credentials">Manage Credentials <ChevronRight /></Link></div>
        </section>
      ) : null}

      {tab === "notifications" ? (
        <section className="settingsTabPanel">
          <div className="settingsTabHero"><Bell /><div><h2>Notifications</h2><p>Control in-console alerts and encrypted external HTTPS delivery for security events.</p></div></div>
          <div className="settingsControlGrid">
            <article><AlertTriangle /><div><b>Critical Incident Alerts</b><small>Include open incidents in the Nodra in-console notification feed.</small></div><Toggle checked={Boolean(form.notifications?.incidentAlerts)} onChange={(v) => updateNested("notifications", "incidentAlerts", v)} disabled={!canEdit} /></article>
            <article><Shield /><div><b>Policy Denial Alerts</b><small>Include denied gateway actions in the Nodra in-console notification feed.</small></div><Toggle checked={Boolean(form.notifications?.denialAlerts)} onChange={(v) => updateNested("notifications", "denialAlerts", v)} disabled={!canEdit} /></article>
            <article><Activity /><div><b>Recovery Alerts</b><small>Include containment, remediation and restart evidence in the notification feed.</small></div><Toggle checked={Boolean(form.notifications?.recoveryAlerts)} onChange={(v) => updateNested("notifications", "recoveryAlerts", v)} disabled={!canEdit} /></article>
          </div>
          <section className="settingsPanel notificationPreview">
            <div className="settingsPanelHead"><span><Bell /></span><div><h3>Live Notification Preview</h3><p>Real workspace alerts filtered by the switches above. Email/Slack delivery is not connected yet.</p></div></div>
            <div className="notificationPreviewList">
              {notificationItems.map((item: any) => <article key={item.key}><span>{item.type}</span><div><b>{item.title}</b><small>{item.detail}</small></div><time>{item.at ? new Date(item.at).toLocaleString() : "Now"}</time></article>)}
              {!notificationItems.length ? <div className="refEmpty">No current alerts match your notification preferences.</div> : null}
            </div>
          </section>
          <button className="settingsSaveWide" disabled={!canEdit || busy === "save"} onClick={() => void saveSettings()}><Save /> Save Notification Preferences</button>
          <ExternalNotifications canEdit={canEdit} />
        </section>
      ) : null}

      {tab === "evidence" ? (
        <section className="settingsTabPanel">
          <div className="settingsTabHero"><FileClock /><div><h2>Evidence & Retention</h2><p>Control workspace evidence preferences and export verified security records.</p></div></div>
          <div className="settingsControlGrid">
            <article><FileClock /><div><b>Hot Evidence Retention</b><small>Enforced by the daily retention worker. Expired events are copied into the immutable archive and marked archived instead of being destructively deleted, preserving Nodra's tamper-evident evidence chain.</small></div><div className="inlineDays"><input type="number" min={1} max={3650} value={form.event_retention_days} onChange={(e) => update("event_retention_days", Number(e.target.value))} disabled={!canEdit} /><span>days</span></div></article>
            <article><ShieldCheck /><div><b>Evidence Integrity</b><small>Tamper-evident chain verification across recorded events.</small></div><em>{overview?.integrity?.valid ? "VERIFIED" : "CHECK"}</em></article>
            <article><Download /><div><b>Workspace Export</b><small>Export real workspace state without plaintext credential secrets.</small></div><a className="outlineSmall" href="/api/settings/export"><Download /> Export</a></article>
          </div>
          <button className="settingsSaveWide" disabled={!canEdit || busy === "save"} onClick={() => void saveSettings()}><Save /> Save Evidence Preferences</button>
        </section>
      ) : null}
    </div>
  );
}
