# Changelog

## 0.1.0-preview.2 — 2026-09-02

- Require an explicit route-level `api: openai-completions` before a provider can be probed or changed.
- Safely exclude routes whose per-model resolved protocol could otherwise be inherited from the installed catalog.
- Restrict proposals to the five reviewed Chat Completions fields and never configure catalog-withheld fields.
- Return a no-write result when Harness refuses a proposal instead of collapsing the refusal into a generic server error.
- Add the protocol policy and blocked reason to redacted community reports.
- Explain skipped routes and blocked protocol/vendor-managed cases in the Web card.
- Add regression coverage for ambiguous routes, unsupported fields, and zero-request exclusion.
- Move CI actions to their current Node 24-based major versions.

## 0.1.0-preview.1 — 2026-09-02

- First public preview.
- Add bounded request-dialect probes for token field, developer role, store, reasoning effort, and streaming usage options.
- Generate the smallest observed `llm-pi-ai` compatibility profile.
- Apply only to the selected model and verify through the real Harness LLM runtime.
- Add automatic rollback on failed verification and explicit ten-minute rollback after success.
- Add cancellation with no settings write.
- Add a one-click redacted community report that excludes endpoint and model identity.
- Verify the packaged plugin on DSH `0.1.1-rc.2` and `0.1.2-alpha.4`.
