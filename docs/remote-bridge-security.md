# Remote Bridge Security

This implementation intentionally uses a simple domain-based trust model.

## Security model

- Bridge is disabled unless `Remote Control` and `Web Bridge` are enabled.
- Incoming page messages require strict protocol validation:
  - exact `source`
  - exact `type`
  - required `requestId`
  - valid action
- Background validates sender origin against allowlist.
- Wildcard domains are rejected.

## Risks of domain-only security

- Any script running on an allowed origin can call the bridge.
- XSS on allowed dashboard domain can become remote-control access.
- DNS/domain takeover of an allowed domain compromises trust.
- No cryptographic request identity (no per-user/session proof).

## Hardening recommendations

- Keep allowlist minimal and explicit.
- Prefer dedicated dashboard domain/subdomain.
- Enforce strong CSP and XSS defenses on dashboard.
- Use HTTPS only for production dashboard origins.
- Rotate to stronger auth later (signed challenge, short-lived tokens, device pairing).

## Common error responses

- `extension not ready`
- `domain not allowed`
- `invalid action`
- `workflow not found`
- `workflow timeout`
