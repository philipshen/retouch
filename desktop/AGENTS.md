# Controlled desktop launch testing has resumed

On 2026-09-11 the user explicitly accepted resuming native testing and launching
Retouch once so they can approve it in macOS Privacy & Security.

The controlled launch of the existing navigation-fixed development bundle
succeeded: its native welcome window was verified through accessibility and a
screenshot. No manual approval was needed for that launch. Controlled native
testing may proceed; this does not establish that rebuilt bundles will launch. Do not retry
blocked launches in a loop or generate recurring warning dialogs. If a rebuilt
app requires a new approval, stop automated launches and explain the situation.
Do not remove quarantine or weaken macOS security settings to avoid a warning.

The build continues to skip native launch tests by default. Keep automated native tests opt-in and bounded; verify the specific build can
launch before running them. Report skipped
or blocked native checks as unverified, never as passing. Approval of a local
build does not prove Developer ID signing, notarization, or trusted distribution.

This supersedes the earlier native-launch pause in historical documentation,
including the migration handoff. The full desktop delivery goal remains active.
