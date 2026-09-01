import { randomUUID } from 'node:crypto'

const MAX_ERROR_BYTES = 16 * 1024
const MAX_TIMEOUT_MS = 60_000
const MIN_TIMEOUT_MS = 2_000
const DEFAULT_TIMEOUT_MS = 12_000
const FIXED_PROMPT = 'Reply with exactly OK.'

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function timeoutOf(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return DEFAULT_TIMEOUT_MS
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, Math.round(number)))
}

function safeBaseURL(value) {
  const url = new URL(String(value))
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('baseURL must use http or https')
  url.username = ''
  url.password = ''
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/+$/, '')
}

function endpointOf(baseURL) {
  return `${safeBaseURL(baseURL)}/chat/completions`
}

function publicTarget(baseURL) {
  const url = new URL(safeBaseURL(baseURL))
  return `${url.origin}${url.pathname}`.replace(/\/$/, '')
}

function requestHeaders(apiKey, declared) {
  const headers = { 'content-type': 'application/json' }
  if (isRecord(declared)) {
    for (const [name, value] of Object.entries(declared)) {
      if (typeof value === 'string') headers[name] = value
    }
  }
  const lower = new Set(Object.keys(headers).map(name => name.toLowerCase()))
  if (typeof apiKey === 'string' && apiKey.trim().length > 0
    && !lower.has('authorization') && !lower.has('x-api-key') && !lower.has('api-key')) {
    headers.authorization = `Bearer ${apiKey.trim()}`
  }
  return headers
}

async function limitedText(response) {
  const declared = Number(response.headers.get('content-length') ?? Number.NaN)
  if (Number.isFinite(declared) && declared > MAX_ERROR_BYTES) return ''
  const text = await response.text()
  return text.slice(0, MAX_ERROR_BYTES)
}

async function errorMeta(response) {
  const text = await limitedText(response)
  try {
    const parsed = JSON.parse(text)
    const root = isRecord(parsed?.error) ? parsed.error : parsed
    return {
      ...(typeof root?.type === 'string' ? { errorType: root.type.slice(0, 80) } : {}),
      ...(typeof root?.code === 'string' ? { errorCode: root.code.slice(0, 80) } : {}),
    }
  } catch {
    return {}
  }
}

function networkCode(error) {
  const raw = error?.cause?.code ?? error?.code
  return typeof raw === 'string' && /^[A-Z0-9_-]{1,80}$/i.test(raw) ? raw : 'NETWORK_ERROR'
}

async function runRequest(options, id, body) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error('probe timeout')), timeoutOf(options.timeoutMs))
  timeout.unref?.()
  const signals = [controller.signal]
  if (options.signal !== undefined) signals.push(options.signal)
  const signal = signals.length === 1 ? signals[0] : AbortSignal.any(signals)
  const started = Date.now()
  try {
    const response = await fetch(endpointOf(options.baseURL), {
      method: 'POST',
      headers: requestHeaders(options.apiKey, options.headers),
      body: JSON.stringify(body),
      signal,
      redirect: 'error',
    })
    const elapsedMs = Date.now() - started
    if (response.ok) {
      await response.body?.cancel().catch(() => {})
      return { id, outcome: 'accepted', httpStatus: response.status, elapsedMs }
    }
    return { id, outcome: 'rejected', httpStatus: response.status, elapsedMs, ...(await errorMeta(response)) }
  } catch (error) {
    const aborted = signal.aborted
    return {
      id,
      outcome: aborted ? 'timeout' : 'network-error',
      errorCode: aborted ? 'TIMEOUT' : networkCode(error),
      elapsedMs: Date.now() - started,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function accepted(result) {
  return result.outcome === 'accepted'
}

function pair(id, control, candidate, recommendation, proposal) {
  let verdict = 'inconclusive'
  if (accepted(control) && accepted(candidate)) verdict = 'both-accepted'
  else if (accepted(control) && !accepted(candidate)) {
    verdict = 'candidate-rejected'
    if (recommendation !== undefined) Object.assign(proposal, recommendation)
  } else if (!accepted(control) && accepted(candidate)) verdict = 'candidate-required'
  else verdict = 'both-failed'
  return { id, verdict, control, candidate }
}

function baseBody(model, maxTokensField, messages = [{ role: 'user', content: FIXED_PROMPT }]) {
  return {
    model,
    messages,
    [maxTokensField]: 1,
  }
}

/**
 * Probe only request-shape differences that map to llm-pi-ai compatibility fields.
 * The result never contains request headers, credentials, prompts, or response bodies.
 */
export async function probeDialect(input) {
  const options = {
    baseURL: safeBaseURL(input.baseURL),
    model: String(input.model ?? '').trim(),
    apiKey: typeof input.apiKey === 'string' ? input.apiKey : '',
    headers: isRecord(input.headers) ? input.headers : {},
    timeoutMs: timeoutOf(input.timeoutMs),
    signal: input.signal,
  }
  if (options.model.length === 0) throw new Error('model is required')

  const proposal = {}
  const probes = []
  let used = 0
  const run = async (id, body) => {
    if (options.signal?.aborted) throw new Error('probe-cancelled')
    used += 1
    return runRequest(options, id, body)
  }

  const maxTokens = await run('max-tokens', { model: options.model, messages: [{ role: 'user', content: FIXED_PROMPT }], max_tokens: 1 })
  const maxCompletionTokens = await run('max-completion-tokens', { model: options.model, messages: [{ role: 'user', content: FIXED_PROMPT }], max_completion_tokens: 1 })
  let maxTokensField
  let maxVerdict
  if (accepted(maxTokens) && !accepted(maxCompletionTokens)) {
    maxTokensField = 'max_tokens'
    proposal.maxTokensField = 'max_tokens'
    maxVerdict = 'max-tokens-only'
  } else if (!accepted(maxTokens) && accepted(maxCompletionTokens)) {
    maxTokensField = 'max_completion_tokens'
    maxVerdict = 'max-completion-tokens-only'
  } else if (accepted(maxTokens) && accepted(maxCompletionTokens)) {
    maxTokensField = 'max_completion_tokens'
    maxVerdict = 'both-accepted'
  } else {
    maxVerdict = 'both-failed'
  }
  probes.push({ id: 'max-token-field', verdict: maxVerdict, control: maxCompletionTokens, candidate: maxTokens })

  if (maxTokensField === undefined) {
    return {
      schemaVersion: 'dsh.provider-passport.v1',
      reportId: randomUUID(),
      status: 'blocked',
      target: { baseURL: publicTarget(options.baseURL), model: options.model },
      proposal,
      probes,
      requestBudget: { planned: 10, used, maxOutputTokensPerRequest: 1, fixedProbeOnly: true, userDataSent: false },
      privacy: 'No credentials, headers, prompts, response bodies, or model output are included in this report.',
    }
  }

  const system = await run('system-role', baseBody(options.model, maxTokensField, [
    { role: 'system', content: 'You are a connectivity probe.' },
    { role: 'user', content: FIXED_PROMPT },
  ]))
  const developer = await run('developer-role', baseBody(options.model, maxTokensField, [
    { role: 'developer', content: 'You are a connectivity probe.' },
    { role: 'user', content: FIXED_PROMPT },
  ]))
  probes.push(pair('developer-role', system, developer, { supportsDeveloperRole: false }, proposal))

  const withoutStore = await run('store-absent', baseBody(options.model, maxTokensField))
  const withStore = await run('store-present', { ...baseBody(options.model, maxTokensField), store: false })
  probes.push(pair('store-field', withoutStore, withStore, { supportsStore: false }, proposal))

  const withoutReasoning = await run('reasoning-effort-absent', baseBody(options.model, maxTokensField))
  const withReasoning = await run('reasoning-effort-present', {
    ...baseBody(options.model, maxTokensField),
    reasoning_effort: 'low',
  })
  probes.push(pair('reasoning-effort-field', withoutReasoning, withReasoning, { supportsReasoningEffort: false }, proposal))

  const streamBase = { ...baseBody(options.model, maxTokensField), stream: true }
  const withoutStreamOptions = await run('stream-options-absent', streamBase)
  const withStreamOptions = await run('stream-options-present', {
    ...streamBase,
    stream_options: { include_usage: true },
  })
  probes.push(pair(
    'stream-options-field',
    withoutStreamOptions,
    withStreamOptions,
    { supportsUsageInStreaming: false },
    proposal,
  ))

  const inconclusive = probes.some(item => item.verdict === 'both-failed' || item.verdict === 'candidate-required')
  return {
    schemaVersion: 'dsh.provider-passport.v1',
    reportId: randomUUID(),
    status: inconclusive ? 'partial' : 'ready',
    target: { baseURL: publicTarget(options.baseURL), model: options.model },
    proposal,
    probes,
    requestBudget: { planned: 10, used, maxOutputTokensPerRequest: 1, fixedProbeOnly: true, userDataSent: false },
    privacy: 'No credentials, headers, prompts, response bodies, or model output are included in this report.',
  }
}
