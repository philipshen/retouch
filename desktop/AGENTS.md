# Desktop launch testing is paused

The user explicitly asked to stop recurring macOS “Retouch Not Opened” warnings.
Do not launch Retouch app bundles, native self-tests, GUI diagnostics, or installed
cask launch checks unless the user explicitly resumes desktop launch testing.
Do not remove quarantine or weaken macOS security settings to avoid the warning.

Packaging and browser-only tests may continue. The build skips native launch tests
by default; do not set RETOUCH_RUN_NATIVE_TESTS=1 while this pause remains in force.
Report skipped native tests as unverified, never as passing. Cask install/uninstall
verification must not execute the installed app during this pause.
