import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { createWorkspace } from "./actions";

export default async function Onboarding() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/auth/github");

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .limit(1);
  if (memberships?.length) redirect("/network");

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
        <a className="onboardingBrand" href="/" aria-label="Nodra home">
          <span className="onboardingBrandMark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>NODRA</span>
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
            <span>1</span>
            <strong>Create Workspace</strong>
          </div>
          <div className="stepLine activeLine" />
          <div className="onboardingStep">
            <span>2</span>
            <strong>Configure Agents</strong>
          </div>
          <div className="stepLine" />
          <div className="onboardingStep">
            <span>3</span>
            <strong>Get Started</strong>
          </div>
        </div>

        <div className="onboardingIntro">
          <h1>Create your security workspace</h1>
          <p>
            This workspace will contain your agents, policies, incidents, evidence
            and recovery state.
          </p>
        </div>

        <form action={createWorkspace} className="workspaceCard">
          <div className="workspaceFormRow">
            <div className="workspaceCube" aria-hidden="true">
              <span>◇</span>
            </div>
            <div className="workspaceField">
              <label htmlFor="workspace-name">Workspace name</label>
              <input
                id="workspace-name"
                name="name"
                required
                minLength={2}
                maxLength={120}
                placeholder="My Nodra Workspace"
                defaultValue="My Nodra Workspace"
                autoComplete="organization"
              />
              <p>Choose a descriptive name for your workspace. You can change this later in settings.</p>
            </div>
          </div>
          <button className="createWorkspaceButton" type="submit">
            <span>Create workspace</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <div className="onboardingBenefits">
          <div>
            <span className="benefitIcon secureIcon">◇</span>
            <p><strong>Secure by design</strong><small>Scoped access from day one</small></p>
          </div>
          <div>
            <span className="benefitIcon agentIcon">◎</span>
            <p><strong>Multi-agent ready</strong><small>Coordinate agents safely</small></p>
          </div>
          <div>
            <span className="benefitIcon auditIcon">▤</span>
            <p><strong>Audit &amp; recovery</strong><small>Full incident traceability</small></p>
          </div>
        </div>

        <div className="onboardingTagline"><span />A safer AI future, together.<span /></div>
      </section>
    </main>
  );
}
