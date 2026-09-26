"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronDown } from "lucide-react";

type Membership = {
  workspace_id: string;
  role: string;
  workspaces:
    | { id: string; name: string; slug: string }[]
    | { id: string; name: string; slug: string }
    | null;
};

function workspaceOf(membership: Membership | null) {
  if (!membership?.workspaces) return null;
  return Array.isArray(membership.workspaces) ? membership.workspaces[0] ?? null : membership.workspaces;
}

export function WorkspaceSwitcher() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeId, setActiveId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/workspace", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((json) => {
        if (cancelled || !json) return;
        const rows = Array.isArray(json.workspaces) ? json.workspaces : [];
        setMemberships(rows);
        setActiveId(String(json.workspace?.workspace_id ?? rows[0]?.workspace_id ?? ""));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const active = useMemo(
    () => memberships.find((item) => item.workspace_id === activeId) ?? memberships[0] ?? null,
    [memberships, activeId],
  );
  const activeWorkspace = workspaceOf(active);

  async function switchWorkspace(workspaceId: string) {
    if (!workspaceId || workspaceId === activeId || busy) return;
    setBusy(true);
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    }).catch(() => null);

    if (!res?.ok) {
      setBusy(false);
      return;
    }

    setActiveId(workspaceId);
    window.location.assign("/network");
  }

  if (!activeWorkspace) {
    return (
      <div className="workspaceSwitcher workspaceSwitcherLoading" aria-label="Workspace">
        <Building2 size={15} />
        <span>Workspace</span>
      </div>
    );
  }

  if (memberships.length <= 1) {
    return (
      <div className="workspaceSwitcher workspaceSwitcherSingle" aria-label="Active workspace">
        <Building2 size={15} />
        <div>
          <strong>{activeWorkspace.name}</strong>
          <span>{active?.role ?? "member"}</span>
        </div>
      </div>
    );
  }

  return (
    <label className="workspaceSwitcher workspaceSwitcherSelect">
      <Building2 size={15} />
      <div>
        <span>Workspace</span>
        <select
          aria-label="Active workspace"
          value={activeId}
          disabled={busy}
          onChange={(event) => void switchWorkspace(event.target.value)}
        >
          {memberships.map((membership) => {
            const workspace = workspaceOf(membership);
            if (!workspace) return null;
            return (
              <option key={membership.workspace_id} value={membership.workspace_id}>
                {workspace.name} · {membership.role}
              </option>
            );
          })}
        </select>
      </div>
      <ChevronDown size={13} aria-hidden="true" />
    </label>
  );
}
