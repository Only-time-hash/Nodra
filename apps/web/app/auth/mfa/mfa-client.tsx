"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

type Factor = { id: string; friendly_name?: string; status?: string; factor_type?: string };

export function MfaClient({ next }: { next: string }) {
  const supabase = createClient();
  const [level, setLevel] = useState<string>("aal1");
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [{ data: aal }, { data: factorData }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    setLevel(aal?.currentLevel ?? "aal1");
    const list = [...(factorData?.totp ?? []), ...(factorData?.phone ?? [])] as Factor[];
    setFactors(list);
    const verified = list.find((f) => f.status === "verified");
    if (verified) setFactorId(verified.id);
    if (aal?.currentLevel === "aal2") window.location.assign(next);
  }

  useEffect(() => { void refresh(); }, []);

  async function enroll() {
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Nodra",
    });
    setBusy(false);
    if (error || !data) {
      setMessage(error?.message ?? "Could not start MFA enrollment.");
      return;
    }
    setFactorId(data.id);
    setQr(data.totp?.qr_code ?? "");
    setSecret(data.totp?.secret ?? "");
  }

  async function verify() {
    if (!factorId || !/^\d{6}$/.test(code)) {
      setMessage("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    await supabase.auth.refreshSession();
    window.location.assign(next);
  }

  const verifiedFactor = factors.find((f) => f.status === "verified");

  return (
    <section style={{width:"min(560px,100%)",background:"#0b1a2a",border:"1px solid #1c3852",borderRadius:18,padding:28}}>
      <p style={{color:"#69c7ff",fontWeight:800,letterSpacing:1}}>NODRA SECURITY</p>
      <h1>Multi-factor authentication</h1>
      <p style={{color:"#9fb2c4",lineHeight:1.6}}>
        This workspace requires an AAL2 session. Use an authenticator app to complete the second factor.
      </p>

      <div style={{margin:"20px 0",padding:16,borderRadius:12,background:"#0e2236"}}>
        <b>Current assurance level: {level.toUpperCase()}</b>
      </div>

      {!verifiedFactor && !factorId ? (
        <button onClick={() => void enroll()} disabled={busy} style={{padding:"12px 18px",borderRadius:10,cursor:"pointer"}}>
          {busy ? "Starting…" : "Set up authenticator"}
        </button>
      ) : null}

      {qr ? (
        <div style={{marginTop:20}}>
          <p>Scan this QR code with your authenticator app.</p>
          <img src={qr} alt="Nodra MFA QR code" style={{width:220,height:220,background:"#fff",padding:8,borderRadius:8}} />
          {secret ? <p style={{wordBreak:"break-all",color:"#9fb2c4"}}>Manual key: <code>{secret}</code></p> : null}
        </div>
      ) : null}

      {(verifiedFactor || factorId) ? (
        <div style={{display:"grid",gap:10,marginTop:20}}>
          <label htmlFor="mfa-code">6-digit authenticator code</label>
          <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g,"").slice(0,6))}
            style={{padding:12,borderRadius:10,border:"1px solid #36526b",background:"#071522",color:"#fff"}} />
          <button onClick={() => void verify()} disabled={busy} style={{padding:"12px 18px",borderRadius:10,cursor:"pointer"}}>
            {busy ? "Verifying…" : "Verify and continue"}
          </button>
        </div>
      ) : null}

      {message ? <p style={{color:"#ffb4b4",marginTop:16}}>{message}</p> : null}
    </section>
  );
}
