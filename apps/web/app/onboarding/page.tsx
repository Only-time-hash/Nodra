import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { createWorkspace } from "./actions";
import Link from "next/link";
import { NodraMark } from "../../components/nodra-mark";

export default async function Onboarding() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/auth/github");

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .limit(1);
  if (memberships?.length) redirect("/onboarding/welcome");

  const metadata = (data.claims.user_metadata ?? {}) as Record<string, unknown>;
  const accountName =
    (typeof metadata.user_name === "string" && metadata.user_name) ||
    (typeof metadata.preferred_username === "string" && metadata.preferred_username) ||
    (typeof metadata.name === "string" && metadata.name) ||
    "GitHub account";
  const avatarUrl = typeof metadata.avatar_url === "string" ? metadata.avatar_url : "";

  return (
    <main className="onboardingPage">
      <div className="onboardingGlow" />
      <div className="onboardingPlanet" />

      <header className="onboardingHeader">
        <a className="onboardingBrand exactOnboardingBrand" href="/" aria-label="Nodra home">
          <span className="onboardingBrandMark"><NodraMark /></span>
          <b>NODRA</b>
        </a>

        <div className="githubIdentity">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" />
          ) : (
            <span className="githubAvatar">{accountName.slice(0, 1).toUpperCase()}</span>
          )}
          <span className="githubIdentityCopy">
            <strong>{accountName}</strong>
            <small>GitHub account connected</small>
          </span>
          <i className="connectedDot" aria-label="Connected" />
        </div>
      </header>

      <section className="onboardingContent">
        <div className="onboardingSteps" aria-label="Onboarding progress">
          <div className="onboardingStep active">
            <span aria-hidden="true">◆</span>
            <strong>Create Workspace</strong>
          </div>
          <div className="stepLine activeLine" />
          <div className="onboardingStep">
            <span aria-hidden="true">○</span>
            <strong>Configure Agents</strong>
          </div>
          <div className="stepLine" />
          <div className="onboardingStep">
            <span aria-hidden="true">○</span>
            <strong>Get Started</strong>
          </div>
        </div>

        <div className="onboardingIntro">
          <h1>Create Your Workspace</h1>
          <p>
            A workspace keeps your agents, data and team organized.
          </p>
        </div>

        <form action={createWorkspace} className="workspaceCard">
          <div className="workspaceFormRow">
            <div className="workspaceCube" aria-hidden="true">
              <svg viewBox="0 0 48 48" role="img">
                <path d="M24 5 39 13.5v17L24 39 9 30.5v-17L24 5Z" />
                <path d="M9 13.5 24 22l15-8.5M24 22v17" />
              </svg>
            </div>
            <div className="workspaceField">
              <label htmlFor="workspace-name">Workspace name</label>
              <input
                id="workspace-name"
                name="name"
                required
                minLength={2}
                maxLength={120}
                placeholder="Acme Corporation"
                defaultValue=""
                autoComplete="organization"
              />
              <p>Choose a descriptive name for your workspace. You can change this later in settings.</p>
            </div>
          </div>
          <button className="createWorkspaceButton" type="submit">
            <span>Create Workspace</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <div className="onboardingBenefits">
          <div>
            <span className="benefitIcon secureIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 20 6v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg></span>
            <p><strong>Secure by design</strong><small>Scoped access from day one</small></p>
          </div>
          <div>
            <span className="benefitIcon agentIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 19c.4-4 2.4-6 5.5-6s5.1 2 5.5 6M14 14c3.8-.5 6.1 1.2 6.5 5"/></svg></span>
            <p><strong>Multi-agent ready</strong><small>Coordinate agents safely</small></p>
          </div>
          <div>
            <span className="benefitIcon auditIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6V3Z"/><path d="M15 3v5h4M9 12h7M9 16h7"/></svg></span>
            <p><strong>Audit &amp; recovery</strong><small>Full incident traceability</small></p>
          </div>
        </div>

        <div className="onboardingTagline"><span />A safer AI future, together.<span /></div>
      </section>
    </main>
  );
}
