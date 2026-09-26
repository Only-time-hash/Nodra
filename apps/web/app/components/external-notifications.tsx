"use client";

import { useEffect, useState } from "react";

type Destination = {
  id: string;
  kind: string;
  label: string;
  enabled: boolean;
  event_types: string[];
};

export function ExternalNotifications({ canEdit }: { canEdit: boolean }) {
  const [items, setItems] = useState<Destination[]>([]);
  const [kind, setKind] = useState("webhook");
  const [label, setLabel] = useState("Security alerts");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["incident", "denial", "recovery"]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch("/api/settings/notifications", { cache: "no-store" });
    const json = await res.json();
    if (res.ok) setItems(json.destinations ?? []);
  }

  useEffect(() => { void load(); }, []);

  function toggleEvent(value: string) {
    setEvents((current) => current.includes(value) ? current.filter((x) => x !== value) : [...current, value]);
  }

  async function save() {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/settings/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, label, endpointUrl, eventTypes: events }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(json.error ?? "Could not save notification destination.");
      return;
    }
    setEndpointUrl("");
    setMessage("External notification destination saved securely.");
    await load();
  }

  async function remove(id: string) {
    setBusy(true);
    const res = await fetch("/api/settings/notifications", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusy(false);
    if (res.ok) await load();
  }

  return (
    <section className="settingsPanel">
      <div className="settingsPanelHead">
        <div>
          <h3>External Alert Delivery</h3>
          <p>Send Nodra security alerts to HTTPS webhooks, Slack, Teams or PagerDuty. Endpoint secrets are stored in Supabase Vault, not in workspace settings.</p>
        </div>
      </div>

      <div className="settingsFormRows">
        <label className="settingsField">
          <span>Destination type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)} disabled={!canEdit || busy}>
            <option value="webhook">Generic webhook</option>
            <option value="slack">Slack incoming webhook</option>
            <option value="teams">Microsoft Teams webhook</option>
            <option value="pagerduty">PagerDuty webhook</option>
          </select>
        </label>

        <label className="settingsField">
          <span>Label</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} disabled={!canEdit || busy} />
        </label>

        <label className="settingsField">
          <span>HTTPS endpoint</span>
          <input type="password" autoComplete="off" placeholder="https://…" value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)} disabled={!canEdit || busy} />
          <small>The plaintext endpoint is sent once to Supabase Vault and is not returned to the browser.</small>
        </label>

        <div className="settingsField">
          <span>Events</span>
          <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
            {["incident","denial","recovery"].map((event) => (
              <label key={event} style={{display:"flex",gap:7,alignItems:"center"}}>
                <input type="checkbox" checked={events.includes(event)} onChange={() => toggleEvent(event)} disabled={!canEdit || busy} />
                {event}
              </label>
            ))}
          </div>
        </div>
      </div>

      <button className="settingsSaveWide" disabled={!canEdit || busy || !endpointUrl || !label || events.length === 0}
        onClick={() => void save()}>
        {busy ? "Saving…" : "Save external destination"}
      </button>

      {message ? <div className="settingsNotice ok">{message}</div> : null}

      <div className="notificationPreviewList" style={{marginTop:16}}>
        {items.map((item) => (
          <article key={item.id}>
            <span>{item.kind}</span>
            <div><b>{item.label}</b><small>{item.event_types.join(", ")}</small></div>
            <button className="outlineSmall" disabled={!canEdit || busy} onClick={() => void remove(item.id)}>Remove</button>
          </article>
        ))}
        {!items.length ? <div className="refEmpty">No external notification destination configured yet.</div> : null}
      </div>
    </section>
  );
}
