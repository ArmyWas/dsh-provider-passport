import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const READY = /dsh web: (http:\/\/[^\s]+)/u
const TOKEN = /([?&]token=)[^\s)]+/gu

function redacted(value) {
  return String(value).replace(TOKEN, '$1<redacted>').replace(/dsh-passport-e2e-key/g, '<redacted>')
}

function environment(root, dshHome) {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/(?:KEY|SECRET|TOKEN|PASSWORD)/iu.test(name)))
  return {
    ...clean,
    DSH_HOME: dshHome,
    DSH_AGENTS_HOME: join(root, '.agents'),
    DSH_TELEMETRY_DISABLED: '1',
    DSH_TELEMETRY_MODE: 'DISABLED',
    MOCK_API_KEY: 'dsh-passport-e2e-key',
    NODE_NO_WARNINGS: '1',
  }
}

async function run(child) {
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk })
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk })
  const code = await new Promise((resolveExit, rejectExit) => {
    child.once('error', rejectExit)
    child.once('exit', resolveExit)
  })
  if (code !== 0) throw new Error(redacted(`command failed (${code})\n${stdout}\n${stderr}`))
  return { stdout, stderr }
}

async function installPlugin(cli, packageRoot, root, dshHome) {
  await mkdir(dshHome, { recursive: true })
  const packageSpec = process.env.DPP_PACKAGE_SPEC?.trim() || `link:${packageRoot}`
  const args = [
    cli,
    'plugin', '--profile', 'web',
    'add', packageSpec, '--ignore-scripts',
  ]
  if (packageSpec.startsWith('link:')) args.push('--offline')
  await run(spawn(process.execPath, args, {
    cwd: root,
    env: environment(root, dshHome),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }))
}

async function startWeb(cli, root, dshHome) {
  const child = spawn(process.execPath, [cli, 'web', '--no-open', '--port', '0'], {
    cwd: root,
    env: environment(root, dshHome),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let output = ''
  const launchUrl = await new Promise((resolveUrl, rejectUrl) => {
    let settled = false
    const timer = setTimeout(() => finish(new Error(`web readiness timeout\n${redacted(output)}`)), 90_000)
    const finish = (error, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) rejectUrl(error)
      else resolveUrl(value)
    }
    const append = chunk => {
      output = `${output}${String(chunk)}`.slice(-100_000)
      const match = READY.exec(output)
      if (match?.[1]) finish(undefined, match[1])
    }
    child.stdout.on('data', append)
    child.stderr.on('data', append)
    child.once('error', finish)
    child.once('exit', code => finish(new Error(`web exited before readiness (${code})\n${redacted(output)}`)))
  })
  return { child, launchUrl, output: () => output }
}

async function stopChild(child) {
  if (child.exitCode !== null) return
  const exited = new Promise(resolveExit => child.once('exit', resolveExit))
  child.kill()
  const timeout = setTimeout(() => child.kill('SIGKILL'), 10_000)
  timeout.unref?.()
  await exited
  clearTimeout(timeout)
}

async function requestShape(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function sendJson(response, status, body) {
  const text = JSON.stringify(body)
  response.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) })
  response.end(text)
}

function sendStream(response) {
  const common = { id: 'chatcmpl-passport-e2e', object: 'chat.completion.chunk', created: 1_788_192_000, model: 'compat-model' }
  response.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' })
  response.write(`data: ${JSON.stringify({ ...common, choices: [{ index: 0, delta: { role: 'assistant', content: 'OK' }, finish_reason: null }] })}\n\n`)
  response.write(`data: ${JSON.stringify({ ...common, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 8, completion_tokens: 1, total_tokens: 9 } })}\n\n`)
  response.end('data: [DONE]\n\n')
}

async function startGateway() {
  const shapes = []
  const server = createServer(async (request, response) => {
    const body = await requestShape(request)
    const roles = Array.isArray(body.messages) ? body.messages.map(message => message.role) : []
    shapes.push({
      roles,
      maxTokensField: Object.hasOwn(body, 'max_tokens') ? 'max_tokens' : Object.hasOwn(body, 'max_completion_tokens') ? 'max_completion_tokens' : 'none',
      hasStreamOptions: Object.hasOwn(body, 'stream_options'),
    })
    const reasons = [
      roles.includes('developer') ? 'developer role unsupported' : '',
      Object.hasOwn(body, 'max_completion_tokens') ? 'max_completion_tokens unsupported' : '',
      Object.hasOwn(body, 'stream_options') ? 'stream_options unsupported' : '',
    ].filter(Boolean)
    if (reasons.length > 0) return sendJson(response, 400, { error: { type: 'invalid_request_error', code: 'unsupported_field' } })
    if (body.stream === true) return sendStream(response)
    sendJson(response, 200, { object: 'chat.completion', choices: [{ message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }] })
  })
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  return { server, shapes, baseURL: `http://127.0.0.1:${address.port}/v1` }
}

async function post(origin, path, cookie, body) {
  const response = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`)
  return JSON.parse(text)
}

async function main() {
  const cli = process.env.DSH_CLI_JS?.trim()
  if (!cli) throw new Error('DSH_CLI_JS must point to the packaged DSH CLI entry')
  const packageRoot = resolve(import.meta.dirname, '..')
  const root = await mkdtemp(join(tmpdir(), 'dsh-provider-passport-e2e-'))
  const dshHome = join(root, '.dsh')
  const gateway = await startGateway()
  let web
  try {
    const versionResult = await run(spawn(process.execPath, [cli, '--version'], {
      cwd: root,
      env: environment(root, dshHome),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }))
    const dshVersion = versionResult.stdout.trim()
    await installPlugin(cli, packageRoot, root, dshHome)
    await writeFile(join(dshHome, 'settings.yaml'), [
      'agent-default-model:',
      '  provider: compat-probe',
      '  model: compat-model',
      '  reasoningEffort: high',
      'llm-pi-ai:',
      '  providers:',
      '    compat-probe:',
      '      displayName: Strict compatibility fixture',
      '      apiKeyEnv: MOCK_API_KEY',
      '      api: openai-completions',
      `      baseURL: ${gateway.baseURL}`,
      '      models:',
      '        - id: compat-model',
      '          contextWindow: 32768',
      '          maxTokens: 512',
      '          reasoningEfforts:',
      '            off:',
      '            high: high',
      '    openai:',
      '      displayName: Ambiguous catalog fixture',
      '      apiKeyEnv: MOCK_API_KEY',
      `      baseURL: ${gateway.baseURL}`,
      '      models:',
      '        - id: gpt-4.1',
      '',
    ].join('\n'), 'utf8')

    web = await startWeb(cli, root, dshHome)
    const launch = new URL(web.launchUrl)
    const exchange = await fetch(web.launchUrl, { redirect: 'manual' })
    assert([200, 303].includes(exchange.status), `unexpected launch status ${exchange.status}`)
    const setCookie = exchange.headers.get('set-cookie')
    if (exchange.status === 303) assert(setCookie)
    const cookie = setCookie?.split(';', 1)[0] ?? ''

    const listed = await post(launch.origin, '/api/dsh-provider-passport/list', cookie, {})
    assert.equal(listed.ok, true)
    assert.equal(listed.providers.length, 1)
    assert.equal(listed.providers[0].id, 'compat-probe')
    assert.equal(listed.protocolGuard.requiredApi, 'openai-completions')
    assert.equal(listed.protocolGuard.resolution, 'explicit-route-api')
    assert.equal(listed.protocolGuard.excludedRoutes.apiNotExplicit, 1)

    const requestsBeforeExcludedProbe = gateway.shapes.length
    const excluded = await post(launch.origin, '/api/dsh-provider-passport/probe', cookie, {
      provider: 'openai',
      model: 'gpt-4.1',
      confirmed: true,
    })
    assert.deepEqual(excluded, { ok: false, error: 'provider-or-model-not-found' })
    const excludedProbeRequests = gateway.shapes.length - requestsBeforeExcludedProbe
    assert.equal(excludedProbeRequests, 0)

    const probed = await post(launch.origin, '/api/dsh-provider-passport/probe', cookie, {
      provider: 'compat-probe',
      model: 'compat-model',
      confirmed: true,
    })
    assert.equal(probed.ok, true)
    assert.equal(probed.report.status, 'ready')
    assert.deepEqual(probed.report.compatibilityPolicy, {
      api: 'openai-completions',
      resolution: 'explicit-route-api',
      proposalFields: [
        'maxTokensField',
        'supportsDeveloperRole',
        'supportsStore',
        'supportsReasoningEffort',
        'supportsUsageInStreaming',
      ],
      configuresCatalogWithheldFields: false,
    })
    assert.deepEqual(probed.report.proposal, {
      maxTokensField: 'max_tokens',
      supportsDeveloperRole: false,
      supportsUsageInStreaming: false,
    })

    const applied = await post(launch.origin, '/api/dsh-provider-passport/apply', cookie, { reportId: probed.report.reportId })
    assert.equal(applied.ok, true)
    assert.equal(applied.verified, true)
    assert.equal(typeof applied.rollbackId, 'string')

    const verifiedShape = gateway.shapes.at(-1)
    assert(verifiedShape.roles.includes('system'))
    assert(!verifiedShape.roles.includes('developer'))
    assert.equal(verifiedShape.maxTokensField, 'max_tokens')
    assert.equal(verifiedShape.hasStreamOptions, false)

    const rolledBack = await post(launch.origin, '/api/dsh-provider-passport/rollback', cookie, { rollbackId: applied.rollbackId })
    assert.deepEqual(rolledBack, { ok: true, rolledBack: true })

    console.log(JSON.stringify({
      experiment: 'dsh-provider-passport-real-bundle-e2e-v1',
      dshVersion,
      packageSource: process.env.DPP_PACKAGE_SPEC ? 'public-registry' : 'local-link',
      bundleLoaded: true,
      providersListed: listed.providers.length,
      protocolGuard: listed.protocolGuard,
      excludedProbeRequests,
      probeStatus: probed.report.status,
      proposedFields: Object.keys(probed.report.proposal).sort(),
      requestBudget: probed.report.requestBudget,
      applied: applied.applied,
      verified: applied.verified,
      rollback: rolledBack.rolledBack,
      verifiedRequestShape: verifiedShape,
      redaction: 'No auth token, credentials, headers, prompts, response bodies, or model output are emitted.',
    }, null, 2))
  } catch (error) {
    throw new Error(redacted(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n${web?.output?.() ?? ''}`))
  } finally {
    if (web) await stopChild(web.child)
    await new Promise((resolveClose, rejectClose) => gateway.server.close(error => error ? rejectClose(error) : resolveClose()))
    const resolvedRoot = resolve(root)
    const resolvedTemp = resolve(tmpdir())
    assert(resolvedRoot.startsWith(`${resolvedTemp}\\`) || resolvedRoot.startsWith(`${resolvedTemp}/`))
    await rm(resolvedRoot, { recursive: true, force: true })
  }
}

await main()
