# Runtime credentials

Customer integration secrets are generated once and stored only as SHA-256 hashes. They can be revoked or rotated.

A separate internal gateway verifier endpoint validates a presented customer credential against the active credential record and its bound agent. The verifier requires NODRA_INTERNAL_GATEWAY_SECRET and server-side SUPABASE_SERVICE_ROLE_KEY; neither value belongs in customer code.

The next gateway protocol revision should use the verified customer credential as the signing key material so deployment-wide master signing material is no longer distributed to customers.
