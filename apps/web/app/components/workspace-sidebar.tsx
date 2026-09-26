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
  ["/agents", "Agents"],
  ["/network/map", "Agent Network"],
  ["/activity", "Security Events"],
  ["/incidents", "Incidents"],
  ["/reports", "Risk Analysis"],
  ["/containment", "Containment"],
  ["/recovery", "Recovery"],
  ["/approvals", "Approvals"],
  ["/credentials", "Credentials"],
  ["/integrations", "Integrations"],
  ["/settings", "Settings"],
] as const;

function Icon({ name }: { name: string }) {
  const props = { size: 18, strokeWidth: 1.7 };
  if (name === "Dashboard") return <LayoutDashboard {...props} />;
  if (name === "Agent Network") return <Network {...props} />;
  if (name === "Agents") return <Bot {...props} />;
  if (name === "Incidents") return <AlertTriangle {...props} />;
  if (name === "Security Events") return <Activity {...props} />;
  if (name === "Approvals") return <ShieldCheck {...props} />;
  if (name === "Credentials") return <KeyRound {...props} />;
  if (name === "Recovery") return <RotateCcw {...props} />;
  if (name === "Risk Analysis") return <FileText {...props} />;
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
