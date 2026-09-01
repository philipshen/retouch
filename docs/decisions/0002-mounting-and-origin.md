# DR-0002: Where the editor mounts — path, port, process, origin

- Status: Accepted (RFC rev 6). Supersedes the provisional positions of revs 3, 4, and 5, which are recorded here because each taught something.
- Date: 2026-09-01
- RFC: OQ-B1, OQ-B4, R-8 (deferred), R-9, §5.1, §8

## Context

The editor shell must host the running app and reach a writer that edits files. Where the shell, the writer, and the app live relative to each other determines origin continuity (cookies, storage, CORS, OAuth), the security boundary, adoption friction (config changes), and the number of processes. This decision went through four positions in one day.

## Options considered

| # | Option | Repo changes | Origin continuity | Processes | Notes |
|---|---|---|---|---|---|
| 1 | Plugin registered in the project's config; shell at `/__mirror` on the app's own dev server | one line | exact | 1 | Same-origin iframe; direct DOM access |
| 2 | Separate editor process on its own port, framing the app cross-origin | none | n/a for the app | 2 | Reintroduces every cross-origin problem for no benefit; rejected early |
| 3 | CLI proxy wrapping an unmodified dev server | none | exact | 2 | Cannot stamp, so inspect-only; survives as OQ-A2 fallback |
| 4 | Parallel dev-server instance on another port (rev 3) | none | partial | 2 | Boots a second Vite instance of the project's own config with the plugin appended; owns its module graph (virtual modules) |
| 5 | Same-port launcher, `npx mirror` (rev 4) | none | exact | 1 | Boots the project's dev server itself, plugin appended, on the usual port |
| 6 | Trust split: mirror process on its own port holds shell + token + writer; app on its usual port in its own process; cross-origin same-site iframe (rev 5) | none (launch) or one line (attach) | exact for the app | 2 | Closes the in-page adversary |

## Arguments as made

**Rev 3 (option 4 added).** The parallel instance gives zero config changes and leaves the primary server untouched, and it owns its module graph so unsaved edits could be served as virtual modules. Cost: a new origin.

**Rev 4 (correction + option 5).** The origin cost of option 4 was overstated: cookies are not isolated by port (RFC 6265 §8.5), so cookie sessions survive; what does not carry is localStorage/IndexedDB, `Origin`-checked CORS allowlists, and exact-match OAuth redirect URIs. The user judged that losing shared storage is a bigger adoption problem than adding one plugin line. The reframing: "zero-config" means zero repository changes, not zero launch changes. Hence option 5: take over the usual port for the session. Exact origin continuity with no repo changes. Costs: port exclusivity; loader-hook injection outside Vite is a version treadmill; single-process blast radius; and a writer endpoint that shares an origin with every script in the app.

**Trade-offs of option 5, ranked (as presented):** (1) the writer shares an origin with arbitrary app code; (2) config fidelity and injection fragility beyond plain Vite; (3) single-process blast radius; (4) instrumentation overhead on normal tabs; (5) port exclusivity; (6) two commands to know; (7) route and HTML injection on their server.

**Rev 5 (option 6 adopted).** Moving only the writer to another port does not fix (1): requests from the shell and from malicious app code carry the same `Origin`, and the token would be readable by any script on that origin. The token holder, the shell, must move too. With shell and writer on `:3999` and the app on `:3000`, the iframe is cross-origin but same-site, which keeps cookies and the app's own storage while making the shell unreachable from app code except via `postMessage`. "Compromised agent" was clarified to mean "any script on the app page", since all scripts in a page share one privilege level. Residual: app code can spoof agent replies during a live gesture; bounded by op validation.

**Rev 6 (reversal to options 1 + 5).** The user's argument: the MVP must be easily adoptable; security trade-offs that fork the architecture are not justified now; no-brainers are welcome. On examination the threat was weaker than argued: a malicious npm package already has full machine access at install time and in the dev-server process (config, plugins, SSR), so the endpoint adds no capability such code lacks; the split only defends against remote CDN scripts and dev-time XSS. Meanwhile op-grammar validation alone bounds any misuse to cosmetic JSX edits with no code execution. The cheap controls (op grammar with a prop exclusion list, `Host` check, custom header + closure-held token, structural IDs) were kept as R-9/R-10. The split became "hardened mode" (R-8 deferred), with interfaces kept RPC-shaped so it can be added without a rewrite.

## Decision

MVP: one process, one origin. The plugin runs in the project's own dev server and serves the shell at `/__mirror` (same-origin iframe, direct DOM access). Two ways to get the plugin in: launch mode (`npx mirror`, no repository changes) and config mode (one line). Option 4 withdrawn (changes the app's origin for no benefit). Option 6 deferred to hardened mode. Option 3 kept as an inspect-only fallback idea.

## Consequences

- Same-origin removes the cross-origin failure class and the RPC-only DOM access requirement for the MVP.
- Residual items in OQ-B1: per-toolchain launch injection (frameworks wrapping Vite need their own embed path; config mode is the fallback), port-busy policy (fail with instructions, never take over), route-collision policy, plugin fault isolation (every hook catches its own errors and serves the module unstamped).
- §8 records the MVP threat model (remote attackers in scope; in-page code out of scope, with rationale), controls, the deferred hardened mode and its trigger (any remote-editing mode, or demonstrated in-page abuse), and the accepted residual risk.
