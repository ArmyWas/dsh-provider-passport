import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const READY = /dsh web: (http:\/\/[^\s]+)/u
const TOKEN = /([?&]token=)[^\s)]+/gu
const GATEWAY_DELAY_MS = Math.max(0, Math.min(10_000, Number(process.env.DPP_VISUAL_GATEWAY_DELAY_MS ?? 0) || 0))

function inside(parent, child) {
  const resolvedParent = resolve(parent)
  const resolvedChild = resolve(child)
  return resolvedChild.startsWith(`${resolvedParent}\\`) || resolvedChild.startsWith(`${resolvedParent}/`)
}

async function recoverStaleBackup(backupFile, workspaceRoot) {
  let backup
  try {
    backup = JSON.parse(await readFile(backupFile, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return
    throw error
  }
  const target = resolve(String(backup?.target ?? ''))
  if (!inside(workspaceRoot, target)) throw new Error('refusing stale settings recovery outside workspace')
  if (backup.existed === true && typeof backup.content === 'string') await writeFile(target, backup.content, 'utf8')
  else await rm(target, { force: true })
  await rm(backupFile, { force: true })
}

function redacted(value) {
  return String(value).replace(TOKEN, '$1<redacted>').replace(/dsh-passport-visual-key/g, '<redacted>')
}

function environment(root, dshHome) {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/(?:KEY|SECRET|TOKEN|PASSWORD)/iu.test(name)))
  return {
    ...clean,
    DSH_HOME: dshHome,
    DSH_AGENTS_HOME: join(root, '.agents'),
    DSH_TELEMETRY_DISABLED: '1',
    DSH_TELEMETRY_MODE: 'DISABLED',
    MOCK_API_KEY: 'dsh-passport-visual-key',
    NODE_NO_WARNINGS: '1',
  }
}

async function requestBody(request) {
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
  const common = { id: 'chatcmpl-passport-visual', object: 'chat.completion.chunk', created: 1_788_192_000, model: 'compat-model' }
  response.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' })
  response.write(`data: ${JSON.stringify({ ...common, choices: [{ index: 0, delta: { role: 'assistant', content: 'OK' }, finish_reason: null }] })}\n\n`)
  response.write(`data: ${JSON.stringify({ ...common, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 8, completion_tokens: 1, total_tokens: 9 } })}\n\n`)
  response.end('data: [DONE]\n\n')
}

async function startGateway() {
  const server = createServer(async (request, response) => {
    try {
      const body = await requestBody(request)
      if (GATEWAY_DELAY_MS > 0) await new Promise(resolveDelay => setTimeout(resolveDelay, GATEWAY_DELAY_MS))
      const roles = Array.isArray(body.messages) ? body.messages.map(message => message.role) : []
      const unsupported = roles.includes('developer')
        || Object.hasOwn(body, 'max_completion_tokens')
        || Object.hasOwn(body, 'stream_options')
      if (unsupported) return sendJson(response, 400, { error: { type: 'invalid_request_error', code: 'unsupported_field' } })
      if (body.stream === true) return sendStream(response)
      return sendJson(response, 200, { object: 'chat.completion', choices: [{ message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }] })
    } catch {
      return sendJson(response, 400, { error: { type: 'invalid_request_error', code: 'malformed_request' } })
    }
  })
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  return { server, baseURL: `http://127.0.0.1:${address.port}/v1` }
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
  return { child, launchUrl }
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return
  const exited = new Promise(resolveExit => child.once('exit', resolveExit))
  child.kill()
  const timeout = setTimeout(() => child.kill('SIGKILL'), 10_000)
  timeout.unref?.()
  await exited
  clearTimeout(timeout)
}

async function main() {
  const cli = process.env.DSH_CLI_JS?.trim()
  if (!cli) throw new Error('DSH_CLI_JS must point to the packaged DSH CLI entry')
  const packageRoot = resolve(import.meta.dirname, '..')
  const root = join(packageRoot, '.e2e')
  const homeName = String(process.env.DPP_VISUAL_HOME_NAME ?? 'dsh-home')
  if (!/^[a-z0-9][a-z0-9._-]*$/iu.test(homeName)) throw new Error('DPP_VISUAL_HOME_NAME must be one safe directory name')
  const externalHome = String(process.env.DPP_VISUAL_EXTERNAL_HOME ?? '').trim()
  const workspaceRoot = resolve(packageRoot, '..', '..')
  const dshHome = externalHome.length > 0 ? resolve(externalHome) : join(root, homeName)
  if (externalHome.length > 0 && !inside(workspaceRoot, dshHome)) {
    throw new Error('DPP_VISUAL_EXTERNAL_HOME must stay inside the workspace')
  }
  const launchFile = join(root, 'visual-launch-url.txt')
  const backupFile = join(root, 'visual-settings-backup.json')
  const settingsFile = join(dshHome, 'settings.yaml')
  await mkdir(dshHome, { recursive: true })
  await recoverStaleBackup(backupFile, workspaceRoot)
  let previousSettings
  let settingsExisted = true
  try {
    previousSettings = await readFile(settingsFile, 'utf8')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    settingsExisted = false
  }

  const gateway = await startGateway()
  let web
  let stopping = false
  const stop = async () => {
    if (stopping) return
    stopping = true
    await rm(launchFile, { force: true })
    await stopChild(web?.child)
    await new Promise(resolveClose => gateway.server.close(() => resolveClose()))
    if (settingsExisted) await writeFile(settingsFile, previousSettings, 'utf8')
    else await rm(settingsFile, { force: true })
    await rm(backupFile, { force: true })
  }

  process.once('SIGINT', () => { void stop().then(() => process.exit(0)) })
  process.once('SIGTERM', () => { void stop().then(() => process.exit(0)) })

  try {
    if (externalHome.length > 0) {
      await writeFile(backupFile, JSON.stringify({ target: settingsFile, existed: settingsExisted, content: previousSettings ?? '' }), { encoding: 'utf8', mode: 0o600 })
    }
    await writeFile(settingsFile, [
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
    await writeFile(launchFile, web.launchUrl, { encoding: 'utf8', mode: 0o600 })
    const origin = new URL(web.launchUrl).origin
    console.log(JSON.stringify({ ready: true, origin, fixture: 'strict-openai-compatible', credentials: 'local-ephemeral-only' }))
    await new Promise((resolveExit, rejectExit) => {
      web.child.once('exit', code => code === 0 || stopping ? resolveExit() : rejectExit(new Error(`web exited (${code})`)))
    })
  } finally {
    await stop()
  }
}

await main().catch(error => {
  console.error(redacted(error instanceof Error ? error.stack ?? error.message : String(error)))
  process.exitCode = 1
})
