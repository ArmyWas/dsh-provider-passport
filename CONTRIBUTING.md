# Contributing

Thank you for helping validate the custom-provider compatibility problem.

## Before opening code

- Use a compatibility-report issue for real endpoint evidence.
- Use Discussions for product questions, ideas, and inconclusive results.
- Open a bug only when the plugin itself behaved incorrectly.
- Never submit credentials, authorization headers, private endpoints, proprietary prompts, or response bodies.

## Development

Requires Node.js 22.19+.

```powershell
npm test
npm pack --dry-run
```

To run the isolated real-Harness bundle test, set `DSH_CLI_JS` to the `lib/bin.js` entry of a packaged `@deepseek-ai/dsh` installation, then run:

```powershell
npm run harness-e2e
```

The test creates a temporary DSH home, uses a deterministic local gateway, verifies the settings mutation through the real Harness LLM runtime, rolls back, and removes the temporary home.

## Pull requests

- Keep the scope limited to request-dialect preflight, evidence, apply/verify, and rollback.
- Add a regression test for every behavior change.
- Preserve the fixed request budget and the privacy contract.
- Do not add automatic telemetry or background probing.
- Explain overlap with existing ecosystem tools when proposing a new probe.

By contributing, you agree that your contribution is licensed under the MIT License.

