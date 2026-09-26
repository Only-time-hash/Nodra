import Link from "next/link";
import { NodraLogo } from "./nodra-logo";
import { WorkspaceSwitcher } from "./workspace-switcher";
import {
  BarChart3,
  Bot,
  Box,
  ClipboardCheck,
  GitBranch,
  Home,
  KeyRound,
  Plug,
  RotateCcw,
  Settings,
  TriangleAlert,
  Waves,
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
  const props = { size: 16, strokeWidth: 1.8 };

  if (name === "Dashboard") return <Home {...props} />;
  if (name === "Agents") return <Bot {...props} />;
  if (name === "Agent Network") return <GitBranch {...props} />;
  if (name === "Security Events") return <Waves {...props} />;
  if (name === "Incidents") return <TriangleAlert {...props} />;
  if (name === "Risk Analysis") return <BarChart3 {...props} />;
  if (name === "Containment") return <Box {...props} />;
  if (name === "Recovery") return <RotateCcw {...props} />;
  if (name === "Approvals") return <ClipboardCheck {...props} />;
  if (name === "Credentials") return <KeyRound {...props} />;
  if (name === "Integrations") return <Plug {...props} />;
  return <Settings {...props} />;
}

export function WorkspaceSidebar({ active }: { active: string }) {
  return (
    <aside className="sidebar">
      <Link className="labBrand exactBrand" href="/network" aria-label="Nodra dashboard">
        <NodraLogo className="workspaceNodraLogo" />
        <span className="consoleBrandWord">Nodra</span>
      </Link>

      <WorkspaceSwitcher />

      <nav className="sideNav" aria-label="Nodra application">
        {nav.map(([href, label]) => (
          <Link key={href} className={label === active ? "active" : ""} href={href}>
            <i><Icon name={label} /></i>
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebarSession">
        <Link href="/settings">
          <Settings size={16} />
          <span>Workspace Settings</span>
        </Link>
      </div>
    </aside>
  );
}
