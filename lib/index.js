import { randomUUID } from 'node:crypto'

import { probeDialect } from './probe.js'

const NS = 'llm-pi-ai'
const API = {
  list: '/api/dsh-provider-passport/list',
  probe: '/api/dsh-provider-passport/probe',
  cancel: '/api/dsh-provider-passport/cancel',
  apply: '/api/dsh-provider-passport/apply',
  rollback: '/api/dsh-provider-passport/rollback',
}
const MAX_BODY_BYTES = 32 * 1024
const REPORT_TTL_MS = 10 * 60 * 1000
const COMPLETIONS_API = 'openai-completions'
const PROPOSAL_FIELDS = Object.freeze([
  'maxTokensField',
  'supportsDeveloperRole',
  'supportsStore',
  'supportsReasoningEffort',
  'supportsUsageInStreaming',
])
const PROPOSAL_FIELD_SET = new Set(PROPOSAL_FIELDS)
const COMPATIBILITY_POLICY = Object.freeze({
  api: COMPLETIONS_API,
  resolution: 'explicit-route-api',
  proposalFields: PROPOSAL_FIELDS,
  configuresCatalogWithheldFields: false,
})

export const name = 'provider-passport'
export const inject = ['webServer', 'settings', 'credentials', 'llm']

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function descriptorOf(settings) {
  return settings?.describe?.().find(descriptor => String(descriptor.ns) === NS)
}

function providersOf(value) {
  return isRecord(value?.providers) ? value.providers : {}
}

function modelRows(profile) {
  return Array.isArray(profile?.models)
    ? profile.models.filter(model => isRecord(model) && typeof model.id === 'string' && model.id.length > 0)
    : []
}

function customRoute(profile) {
  return isRecord(profile)
    && typeof profile.baseURL === 'string'
    && profile.baseURL.length > 0
}

/**
 * Only an explicit route-level API proves every resolved model uses Chat Completions.
 * When the route API is absent, DSH may inherit a different protocol from each
 * installed catalog model. The public LLM metadata surface does not expose that
 * resolved wire protocol, so guessing would make an unsafe proposal possible.
 */
export function routeProtocolDecision(profile) {
  if (!customRoute(profile)) return { eligible: false, reason: 'not-custom-route' }
  if (profile.api === undefined) return { eligible: false, reason: 'api-not-explicit' }
  if (profile.api !== COMPLETIONS_API) return { eligible: false, reason: 'unsupported-api' }
  return { eligible: true, api: COMPLETIONS_API }
}

export function proposalFieldsAllowed(proposal) {
  return isRecord(proposal) && Object.keys(proposal).every(field => PROPOSAL_FIELD_SET.has(field))
}

function rawProvider(descriptor, provider) {
  const user = providersOf(descriptor?.user)
  return Object.hasOwn(user, provider) && isRecord(user[provider]) ? user[provider] : undefined
}

async function apiKeyFor(ctx, profile) {
  if (typeof profile.apiKeyEnv !== 'string' || profile.apiKeyEnv.length === 0) return ''
  const resolved = await ctx.get('credentials')?.resolve(profile.apiKeyEnv)
  return typeof resolved?.value === 'string' ? resolved.value : ''
}

function sanitizeError(error) {
  const failure = isRecord(error?.failure) ? error.failure : error
  return {
    code: typeof failure?.code === 'string' ? failure.code.slice(0, 80) : 'VERIFY_FAILED',
    ...(Number.isInteger(failure?.status) ? { status: failure.status } : {}),
  }
}

function settingsFailure(error) {
  const sanitized = sanitizeError(error)
  return sanitized.code === 'VERIFY_FAILED' ? { ...sanitized, code: 'SETTINGS_REJECTED' } : sanitized
}

function userMessage() {
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text: 'Reply with exactly OK.' }],
    source: { kind: 'user' },
  }
}

function effortFor(model) {
  if (!isRecord(model?.reasoningEfforts)) return undefined
  for (const level of ['high', 'medium', 'low', 'minimal', 'xhigh', 'max']) {
    if (Object.hasOwn(model.reasoningEfforts, level)) return level
  }
  return undefined
}

/** Verify the persisted profile through the actual DSH LLM runtime. */
export async function verifyThroughHarness(llm, provider, model, reasoningEffort, timeoutMs = 15_000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  timeout.unref?.()
  try {
    const options = {
      provider,
      model,
      system: 'You are a connectivity probe.',
      messages: [userMessage()],
      maxTokens: 8,
      signal: controller.signal,
      ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
    }
    for await (const chunk of llm.stream(options)) {
      if (chunk.type !== 'finish') continue
      const kind = chunk.reason?.kind
      if (kind === 'stop' || kind === 'max-tokens' || kind === 'tool-calls') return { ok: true, finishReason: kind }
      if (kind === 'error' || kind === 'aborted') return { ok: false, failure: sanitizeError(chunk.reason?.failure) }
      return { ok: true, finishReason: String(kind ?? 'unknown') }
    }
    return { ok: false, failure: { code: 'NO_FINISH' } }
  } catch (error) {
    return { ok: false, failure: sanitizeError(error) }
  } finally {
    clearTimeout(timeout)
  }
}

/** Merge only the selected model's compat profile; all other rows stay byte-for-byte equivalent under JSON data. */
export function modelsWithProposal(models, modelId, proposal) {
  let found = false
  const next = models.map(model => {
    if (!isRecord(model) || model.id !== modelId) return structuredClone(model)
    found = true
    return {
      ...structuredClone(model),
      compat: {
        ...(isRecord(model.compat) ? structuredClone(model.compat) : {}),
        ...structuredClone(proposal),
      },
    }
  })
  if (!found) throw new Error('model-not-writable')
  return next
}

function listPayload(settings, state) {
  const descriptor = descriptorOf(settings)
  const effective = providersOf(descriptor?.value)
  const exclusions = { apiNotExplicit: 0, unsupportedApi: 0 }
  const providers = Object.entries(effective).flatMap(([id, profile]) => {
    const decision = routeProtocolDecision(profile)
    if (!decision.eligible) {
      if (decision.reason === 'api-not-explicit') exclusions.apiNotExplicit += 1
      if (decision.reason === 'unsupported-api') exclusions.unsupportedApi += 1
      return []
    }
    const raw = rawProvider(descriptor, id)
    return [{
      id,
      displayName: typeof profile.displayName === 'string' ? profile.displayName : id,
      writable: raw !== undefined && Array.isArray(raw.models),
      models: modelRows(profile).map(model => ({
        id: model.id,
        name: typeof model.name === 'string' ? model.name : model.id,
        compat: isRecord(model.compat) ? model.compat : {},
      })),
    }]
  })
  return {
    ok: true,
    writable: settings?.writable === true,
    providers,
    running: [...state.running.keys()],
    protocolGuard: {
      requiredApi: COMPLETIONS_API,
      resolution: 'explicit-route-api',
      excludedRoutes: exclusions,
    },
    requestPlan: {
      requests: 10,
      maxOutputTokensPerRequest: 1,
      fixedProbeOnly: true,
      userFilesOrConversationSent: false,
      mayIncurProviderCharges: true,
    },
  }
}

function isLoopbackRequest(request) {
  const address = request.socket.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const host = request.headers.host
  if (typeof host !== 'string') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function writeJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new Error('body-too-large')
    chunks.push(buffer)
  }
  if (chunks.length === 0) return {}
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  return isRecord(value) ? value : {}
}

function cleanup(state) {
  const now = Date.now()
  for (const [id, entry] of state.reports) if (entry.expiresAt <= now) state.reports.delete(id)
  for (const [id, entry] of state.rollbacks) if (entry.expiresAt <= now) state.rollbacks.delete(id)
}

async function runProbe(ctx, state, body) {
  if (body.confirmed !== true) return { ok: false, error: 'confirmation-required' }
  const provider = typeof body.provider === 'string' ? body.provider : ''
  const model = typeof body.model === 'string' ? body.model : ''
  const key = `${provider}\u0000${model}`
  if (!provider || !model) return { ok: false, error: 'provider-and-model-required' }
  if (state.running.has(key)) return { ok: false, error: 'probe-already-running' }
  const descriptor = descriptorOf(ctx.settings)
  const profile = providersOf(descriptor?.value)[provider]
  if (!routeProtocolDecision(profile).eligible || !modelRows(profile).some(row => row.id === model)) {
    return { ok: false, error: 'provider-or-model-not-found' }
  }
  const apiKey = await apiKeyFor(ctx, profile)
  if (typeof profile.apiKeyEnv === 'string' && profile.apiKeyEnv.length > 0 && apiKey.length === 0) {
    return { ok: false, error: 'credential-missing' }
  }
  const controller = new AbortController()
  state.running.set(key, controller)
  try {
    const report = await probeDialect({
      baseURL: profile.baseURL,
      model,
      apiKey,
      headers: isRecord(profile.headers) ? profile.headers : {},
      timeoutMs: 12_000,
      signal: controller.signal,
    })
    if (controller.signal.aborted) return { ok: false, error: 'probe-cancelled' }
    const guardedReport = {
      ...report,
      compatibilityPolicy: structuredClone(COMPATIBILITY_POLICY),
    }
    if (!proposalFieldsAllowed(guardedReport.proposal)) {
      return { ok: false, error: 'proposal-outside-supported-fields' }
    }
    cleanup(state)
    state.reports.set(guardedReport.reportId, {
      provider,
      model,
      proposal: structuredClone(guardedReport.proposal),
      revision: descriptor.revision,
      expiresAt: Date.now() + REPORT_TTL_MS,
    })
    return { ok: true, report: guardedReport }
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, error: 'probe-cancelled' }
    return { ok: false, error: 'probe-failed', failure: sanitizeError(error) }
  } finally {
    state.running.delete(key)
  }
}

function runCancel(state, body) {
  const provider = typeof body.provider === 'string' ? body.provider : ''
  const model = typeof body.model === 'string' ? body.model : ''
  const controller = state.running.get(`${provider}\u0000${model}`)
  if (controller === undefined) return { ok: false, error: 'no-probe-running' }
  controller.abort(new Error('probe-cancelled'))
  return { ok: true, cancelled: true }
}

async function runApply(ctx, state, body) {
  cleanup(state)
  const reportId = typeof body.reportId === 'string' ? body.reportId : ''
  const cached = state.reports.get(reportId)
  if (cached === undefined) return { ok: false, error: 'report-expired-or-missing' }
  if (Object.keys(cached.proposal).length === 0) return { ok: false, error: 'no-changes-proposed' }
  if (!proposalFieldsAllowed(cached.proposal)) return { ok: false, error: 'proposal-outside-supported-fields' }
  if (ctx.settings.writable !== true) return { ok: false, error: 'settings-read-only' }
  const descriptor = descriptorOf(ctx.settings)
  if (descriptor?.revision !== cached.revision) return { ok: false, error: 'settings-changed-rerun-probe' }
  const profile = providersOf(descriptor?.value)[cached.provider]
  if (!routeProtocolDecision(profile).eligible) return { ok: false, error: 'protocol-changed-rerun-probe' }
  const raw = rawProvider(descriptor, cached.provider)
  if (raw === undefined || !Array.isArray(raw.models)) return { ok: false, error: 'provider-models-not-writable' }
  const oldModels = structuredClone(raw.models)
  let nextModels
  try {
    nextModels = modelsWithProposal(oldModels, cached.model, cached.proposal)
  } catch {
    return { ok: false, error: 'model-not-writable' }
  }

  try {
    await ctx.settings.mutate(
      NS,
      [{ op: 'set', path: ['providers', cached.provider, 'models'], value: nextModels }],
      descriptor.revision,
    )
  } catch (error) {
    state.reports.delete(reportId)
    return { ok: false, error: 'proposal-refused-no-write', failure: settingsFailure(error) }
  }
  await new Promise(resolve => setTimeout(resolve, 0))
  const chosenModel = nextModels.find(model => isRecord(model) && model.id === cached.model)
  const verification = await verifyThroughHarness(ctx.llm, cached.provider, cached.model, effortFor(chosenModel))
  if (!verification.ok) {
    const after = descriptorOf(ctx.settings)
    try {
      await ctx.settings.mutate(
        NS,
        [{ op: 'set', path: ['providers', cached.provider, 'models'], value: oldModels }],
        after.revision,
      )
      state.reports.delete(reportId)
      return { ok: false, error: 'verification-failed-rolled-back', verification }
    } catch {
      return { ok: false, error: 'verification-failed-rollback-conflict', verification }
    }
  }

  const current = descriptorOf(ctx.settings)
  const rollbackId = randomUUID()
  state.rollbacks.set(rollbackId, {
    provider: cached.provider,
    oldModels,
    revision: current.revision,
    expiresAt: Date.now() + REPORT_TTL_MS,
  })
  state.reports.delete(reportId)
  return { ok: true, applied: true, verified: true, verification, rollbackId, rollbackExpiresInMs: REPORT_TTL_MS }
}

async function runRollback(ctx, state, body) {
  cleanup(state)
  const rollbackId = typeof body.rollbackId === 'string' ? body.rollbackId : ''
  const cached = state.rollbacks.get(rollbackId)
  if (cached === undefined) return { ok: false, error: 'rollback-expired-or-missing' }
  const descriptor = descriptorOf(ctx.settings)
  if (descriptor?.revision !== cached.revision) return { ok: false, error: 'settings-changed-rollback-refused' }
  await ctx.settings.mutate(
    NS,
    [{ op: 'set', path: ['providers', cached.provider, 'models'], value: cached.oldModels }],
    descriptor.revision,
  )
  state.rollbacks.delete(rollbackId)
  return { ok: true, rolledBack: true }
}

function route(path, handler) {
  return {
    kind: 'exact',
    path,
    handler: async (request, response) => {
      if (!isLoopbackRequest(request)) return writeJson(response, 403, { ok: false, error: 'forbidden' })
      if (request.method !== 'POST') return writeJson(response, 405, { ok: false, error: 'method-not-allowed' })
      try {
        writeJson(response, 200, await handler(await readJson(request)))
      } catch (error) {
        writeJson(response, 500, { ok: false, error: 'request-failed', failure: sanitizeError(error) })
      }
    },
  }
}

export function apply(ctx) {
  const state = { reports: new Map(), rollbacks: new Map(), running: new Map() }
  ctx.effect(() => {
    const routes = [
      route(API.list, async () => listPayload(ctx.settings, state)),
      route(API.probe, body => runProbe(ctx, state, body)),
      route(API.cancel, body => runCancel(state, body)),
      route(API.apply, body => runApply(ctx, state, body)),
      route(API.rollback, body => runRollback(ctx, state, body)),
    ]
    const disposers = routes.map(item => ctx.webServer.register(item))
    return () => {
      for (const dispose of disposers) dispose()
      state.reports.clear()
      state.rollbacks.clear()
      for (const controller of state.running.values()) controller.abort(new Error('plugin-disposed'))
      state.running.clear()
    }
  }, 'provider-passport:routes')
}
