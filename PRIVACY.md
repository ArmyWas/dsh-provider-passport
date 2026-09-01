# Privacy design

DSH Provider Passport is intentionally local and opt-in.

## Network activity

The plugin makes network requests only after the user selects a model and confirms the displayed request budget. It sends at most ten fixed Chat Completions requests to the endpoint already configured for that model. Each request asks for at most one output token and has a 12-second timeout.

The fixed probe content is not derived from user files, conversations, sessions, tools, or prior model output. The plugin has no analytics, telemetry, crash reporting, update checker, or background scheduler.

## Credentials

Credentials and custom request headers are obtained from the active Harness provider configuration and used in memory for the probe. They are never written into the plugin report, console output, settings patch, or shareable evidence.

The plugin never uploads a report. Sharing always requires the user to click **Copy redacted report** and then paste the result somewhere else.

## Shareable report

The community report includes only:

- plugin and report schema versions;
- overall status;
- proposed Harness compatibility fields;
- per-probe verdicts, HTTP status, and short machine-readable error type/code when available;
- the fixed request budget;
- whether real-Harness verification was run successfully.

It excludes endpoint URL, model id, credentials, headers, request text, response bodies, model output, report identifiers, and timing values.

HTTP status and machine-readable error codes can still reveal limited implementation characteristics. Review the copied JSON before posting it. Do not attach screenshots that expose a private endpoint, account name, model name, organization, or billing information.

## Settings and recovery

Only the selected model's `compat` object can be changed. The previous model configuration is kept in memory for ten minutes. Verification failure restores it automatically; successful verification exposes an explicit rollback button for the same period.

## Questions

Use GitHub Discussions for privacy questions that do not contain sensitive information. Report a suspected vulnerability through GitHub private vulnerability reporting, not a public issue.

