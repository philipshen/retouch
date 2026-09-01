# DR-0007: How the mirror URL maps to the app URL

- Status: Open
- Date: 2026-09-01
- RFC: OQ-B6

## Context

Under DR-0006, the shell at a reserved route embeds the app in an iframe. The original pitch was "change the URL, get the editor". Three behaviors need rules: how the shell's URL names the app page, how in-app navigation is reflected, and what a reload or deep link does. The user asked for the full alternative set before deciding.

## Options considered

**Shell URL scheme**

| # | Scheme | Example | For | Against |
|---|---|---|---|---|
| 1 | Prefix path | `/__mirror/about?id=7#x` | App path, query, and hash pass through unencoded; server routing is a prefix match; one reserved prefix, nothing else touched | An app route beginning with `/__mirror` collides (policy in OQ-B1) |
| 2 | Query flag on the app's own URL | `/about?id=7&__mirror` | Reads as "append the flag to any page"; the URL stays the app's own | Reserves one query name across every route; the flag must be stripped when forwarding; the server must inspect the query on every HTML request |
| 3 | Query parameter carrying the app URL | `/__mirror?u=%2Fabout%3Fid%3D7` | No prefix-collision issue | Ugly; the app URL must be percent-encoded, including its own query and hash |
| 4 | Hash carrying the app URL | `/__mirror#/about?id=7` | Client-only; no server route per page | Not "change the path"; collides with the app's own hash state, which then needs a second encoding |
| 5 | Fixed shell URL, no mapping | `/__mirror` | Simplest | No reload, deep link, or bookmark to a page; navigation inside the frame is invisible in the URL bar |
| 6 | Subdomain | `mirror.localhost:3000/about` | Resolves to loopback without hosts-file edits in Chrome and Firefox | A different host is a different origin: breaks cookies and storage; rejected on the same grounds as DR-0002 option C |
| 7 | Browser extension / DevTools panel | no URL | No iframe, no route, no forwarding | A different product and distribution model; out of scope |

**Following in-app navigation**

| # | Mechanism | For | Against |
|---|---|---|---|
| a | Shell observes the iframe's `location` (same origin) and rewrites its own URL; the agent wraps `history.pushState`/`replaceState` to report SPA navigations (they fire no event across frames) | Cross-browser; small, deterministic patch | Wrapping history is a global patch inside the app page (dev only) |
| b | Navigation API (`navigation.addEventListener('navigate', …)`) | No monkey-patching | Chromium only as of 2026 [UNVERIFIED for Safari/Firefox status] |
| c | Do not follow | Nothing to build | URL bar goes stale; reload lands on the wrong page |

**Selection persistence across reload**

| # | Mechanism | For | Against |
|---|---|---|---|
| i | None in v1 | Simplest | Reload loses the selection |
| ii | `sessionStorage` keyed by page | Survives reload | Not shareable |
| iii | Selection ID in the shell URL, e.g. `/__mirror/about?sel=<id>` | Shareable deep link to one element; structural IDs make it stable across attribute edits | Reserves a query name in the shell's own namespace (not the app's, so no collision) |

**Frame busting.** Some apps navigate `window.top` out of frames. Options: detect the unload and show a message (proposed); or attempt to block via `sandbox` attributes, which would also break the app. Blocking is rejected.

## Recommendation (pending decision)

Scheme 1 with (a) and (i). Scheme 2 is the closest competitor and reads well; it loses on reserving a query name across all routes and on stripping. Option iii is worth adopting later: shareable element links are a natural feature once structural IDs exist.

## Decision

Pending.
