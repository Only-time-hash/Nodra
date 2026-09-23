import Link from "next/link";
import { GitHubAuthButton } from "../../components/github-auth-button";
import "./auth.css";

function NodraMark() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="nodraAuthGradient" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f3fbff" />
          <stop offset="0.48" stopColor="#9bdcff" />
          <stop offset="1" stopColor="#2e8fff" />
        </linearGradient>
      </defs>
      <g fill="url(#nodraAuthGradient)">
        <path d="M31 5C20 5 13 10 9 19c9-1 16 3 22 12V5Z" />
        <path d="M59 31c0-11-5-18-14-22 1 9-3 16-12 22h26Z" />
        <path d="M33 59c11 0 18-5 22-14-9 1-16-3-22-12v26Z" />
        <path d="M5 33c0 11 5 18 14 22-1-9 3-16 12-22H5Z" />
      </g>
      <circle cx="32" cy="32" r="7" fill="#061522" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.02c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.29-5.27-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18A10.9 10.9 0 0 1 12 6.33c.98 0 1.95.13 2.86.39 2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.4-2.71 5.38-5.29 5.67.42.36.79 1.07.79 2.16v3.04c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
    </svg>
  );
}

type AuthPageProps = {
  searchParams: Promise<{ intent?: string }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const intent = params.intent === "signin" ? "signin" : "signup";

  return (
    <main className="authGatePage">
      <div className="authGateShade" aria-hidden="true" />

      <header className="authGateHeader">
        <Link className="authGateBrand" href="/" aria-label="Nodra home">
          <span className="authGateBrandMark">
            <NodraMark />
          </span>
          <b>NODRA</b>
        </Link>
      </header>

      <section className="authGateStage">
        <div className="authGatePanel">
          <span className="authGateCenterMark" aria-hidden="true">
            <NodraMark />
          </span>

          <h1>
            Secure the AI agents
            <br />
            that power your business.
          </h1>

          <p className="authGatePromise">
            Identity. Authority. Control. Evidence.
            <br />
            A safer future for autonomous AI.
          </p>

          <GitHubAuthButton className="authGateGithub" intent={intent}>
            <span className="authGateGithubContent">
              <GitHubIcon />
              <span>Continue with GitHub</span>
            </span>
          </GitHubAuthButton>

          <p className="authGateTerms">
            By continuing, you agree to our
            <br />
            <Link href="/terms">Terms of Service</Link>
            {" and "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
