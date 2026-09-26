import Link from "next/link";
import { NodraLogo } from "./nodra-logo";
import {
  Activity,
  AlertTriangle,
  Bot,
  FileText,
  KeyRound,
  LayoutDashboard,
  Network,
  RotateCcw,
  Settings,
  Shield,
  ShieldCheck,
} from "lucide-react";

const nav = [
  ["/network", "Dashboard"],
  ["/network/map", "Network"],
  ["/agents", "Agents"],
  ["/incidents", "Incidents"],
  ["/activity", "Activity"],
  ["/approvals", "Approvals"],
  ["/policies", "Policies"],
  ["/credentials", "Credentials"],
  ["/containment", "Containment"],
  ["/recovery", "Recovery"],
  ["/reports", "Reports"],
  ["/settings", "Settings"],
] as const;

function Icon({ name }: { name: string }) {
  const props = { size: 18, strokeWidth: 1.7 };
  if (name === "Dashboard") return <LayoutDashboard {...props} />;
  if (name === "Network") return <Network {...props} />;
  if (name === "Agents") return <Bot {...props} />;
  if (name === "Incidents") return <AlertTriangle {...props} />;
  if (name === "Activity") return <Activity {...props} />;
  if (name === "Approvals") return <ShieldCheck {...props} />;
  if (name === "Credentials") return <KeyRound {...props} />;
  if (name === "Recovery") return <RotateCcw {...props} />;
  if (name === "Reports") return <FileText {...props} />;
  if (name === "Settings") return <Settings {...props} />;
  return <Shield {...props} />;
}

export function WorkspaceSidebar({ active }: { active: string }) {
  return (
    <aside className="sidebar">
      <Link className="labBrand exactBrand" href="/network" aria-label="Nodra dashboard">
        <NodraLogo className="workspaceNodraLogo" />
      </Link>

      <p className="workspace">AGENT SECURITY CONTROL PLANE</p>

      <nav className="sideNav" aria-label="Nodra application">
        {nav.map(([href, label]) => (
          <Link key={href} className={label === active ? "active" : ""} href={href}>
            <i><Icon name={label} /></i>
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="labScope">
        <strong>Live workspace</strong>
        <p>Real customer agents, authority and security evidence.</p>
      </div>
    </aside>
  );
}
