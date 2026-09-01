# Public preview tester guide

The goal is to learn whether real third-party, enterprise, or self-hosted OpenAI-compatible endpoints reject request shapes produced by Harness—and whether a minimal Harness `compat` profile fixes the failure.

## Safe test flow

1. Update to the newest `preview` version of DSH Provider Passport.
2. In Harness, confirm that the custom provider and model already exist.
3. Open **Settings → Plugins → Provider compatibility passport**.
4. Read the displayed request and cost budget.
5. Select the provider/model and confirm the preflight.
6. Review the proposed fields before applying anything.
7. If the proposal is sensible, choose **Apply and verify through Harness**.
8. Click **Copy redacted report** and inspect the JSON before sharing it.
9. Use the compatibility-report issue form.

## Evidence that is useful

- exact DSH version from `dsh --version`;
- plugin version;
- broad endpoint category: hosted vendor, enterprise gateway, self-hosted proxy, or local server;
- copied redacted report;
- whether the same model failed during a normal Harness task before the preflight;
- whether apply + real-Harness verification succeeded;
- a screenshot only when it contains no private endpoint, account, model, organization, credential, billing data, prompt, or response.

## Evidence that must not be posted

- API keys, tokens, cookies, or authorization headers;
- full private endpoints or internal hostnames;
- proprietary model ids when they identify an internal deployment;
- user prompts, files, tool data, conversations, or response bodies;
- unredacted Harness settings or credential files.

If the copied report appears to contain any of the above, do not post it. Open a security advisory instead.

## Interpretation

- `ready` with a proposal: at least one paired request isolated a request-dialect difference.
- `ready` without a proposal: tested shapes were accepted; this is useful negative-control evidence.
- `partial`: some pairs were inconclusive; discuss before applying.
- `blocked`: neither bounded token-field form worked, so the plugin stopped without writing settings.

One report is evidence of a concrete compatibility case, not proof that every endpoint from the same vendor behaves identically.

