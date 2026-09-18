const lifecycle = [
  ["01", "Control", "Define explicit boundaries around what agents may access and do."],
  ["02", "Observe", "Record consequential agent actions and the systems they touch."],
  ["03", "Trace", "Follow authority, delegation, and propagation across an agent network."],
  ["04", "Contain", "Isolate affected branches while leaving safe parts of the system available."],
  ["05", "Investigate", "Reconstruct observable events and determine the incident blast radius."],
  ["06", "Recover", "Build a reviewable plan for credentials, state, jobs, and affected resources."],
];

export default function HomePage() {
  return (
    <main>
      <header className="nav shell">
        <a className="brand" href="#top" aria-label="Nodra home"><span className="brandMark">N</span>NODRA</a>
        <nav aria-label="Primary navigation">
          <a href="#product">Product</a>
          <a href="#developers">Developers</a>
          <a href="#docs">Docs</a>
        </nav>
        <div className="navActions">
          <a className="textButton" href="#signin">Sign in</a>
          <a className="button small" href="#github">Sign up with GitHub</a>
        </div>
      </header>

      <section className="hero shell" id="top">
        <div className="eyebrow"><span /> Security infrastructure for autonomous agents</div>
        <h1>Control the blast radius<br />of <em>autonomous AI.</em></h1>
        <p className="heroCopy">
          Nodra controls what agents can access and do, traces dangerous actions across connected
          systems, contains affected agents, and supports safe recovery.
        </p>
        <div className="heroActions">
          <a className="button" href="#github">Sign up with GitHub <b>→</b></a>
          <a className="secondaryButton" href="#product">Explore Nodra</a>
        </div>

        <div className="networkCard" aria-label="Conceptual Nodra agent network">
          <div className="networkGlow" />
          <div className="networkTitle"><span className="liveDot" /> Nodra control plane <small>Conceptual architecture</small></div>
          <div className="network">
            <div className="node human">Human</div><div className="line l1" />
            <div className="node manager">Manager Agent</div>
            <div className="line branch b1" /><div className="line branch b2" /><div className="line branch b3" />
            <div className="node research risk">Research <span>at risk</span></div>
            <div className="node finance">Finance <span>healthy</span></div>
            <div className="node support">Support <span>healthy</span></div>
          </div>
          <div className="networkFoot">
            <span>Authority and action paths become visible.</span>
            <span className="status"><i /> Healthy <i className="amber" /> At risk</span>
          </div>
        </div>
      </section>

      <section className="section shell" id="product">
        <div className="sectionIntro">
          <p className="kicker">THE PROBLEM</p>
          <h2>AI agents do more than answer.<br /><span>They take action.</span></h2>
          <p>Once an agent can use tools, credentials, databases, email, code, or other agents, a bad instruction can become a system incident. Nodra is being built for that boundary.</p>
        </div>
        <div className="principleGrid">
          <article><strong>01</strong><h3>Hard boundaries</h3><p>Deterministic policy decides whether consequential actions are allowed, denied, or require human approval.</p></article>
          <article><strong>02</strong><h3>Visible consequences</h3><p>Track which agent touched which resource and what downstream actions may depend on it.</p></article>
          <article><strong>03</strong><h3>Selective response</h3><p>Contain the affected branch instead of treating every incident as a reason to shut down everything.</p></article>
        </div>
      </section>

      <section className="section darkBand" id="developers">
        <div className="shell">
          <p className="kicker">NODRA LIFECYCLE</p>
          <h2>From permission to recovery.</h2>
          <div className="lifecycle">
            {lifecycle.map(([number, title, body]) => (
              <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></article>
            ))}
          </div>
        </div>
      </section>

      <section className="section shell buildSection" id="docs">
        <div>
          <p className="kicker">BUILDING V0.1</p>
          <h2>Prove containment<br />before making promises.</h2>
        </div>
        <div className="buildCopy">
          <p>Our first milestone is intentionally narrow: an owned five-agent laboratory where a simulated compromised agent can be traced and selectively contained without unnecessarily stopping unaffected agents.</p>
          <div className="terminal">
            <div><i /><i /><i /></div>
            <code><span>$</span> nodra laboratory start<br /><b>✓</b> 5 agents connected<br /><b>✓</b> policy gateway active<br /><b>✓</b> event recording active<br /><span>→</span> ready for controlled security tests</code>
          </div>
        </div>
      </section>

      <section className="cta shell" id="github">
        <div><p className="kicker">BUILD WITH US</p><h2>Autonomous agents need<br /><span>real boundaries.</span></h2></div>
        <div><p>Nodra is early-stage. Join through GitHub as we build the first working containment and recovery system.</p><a className="button" href="#signin">Sign up with GitHub →</a></div>
      </section>

      <footer className="footer shell" id="signin">
        <a className="brand" href="#top"><span className="brandMark">N</span>NODRA</a>
        <p>Containment, provenance, and recovery infrastructure for autonomous AI agents.</p>
        <p className="muted">V0.1 · Built in public</p>
      </footer>
    </main>
  );
}
