import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'

import { probeDialect } from '../lib/probe.js'

async function bodyOf(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function json(response, status, body) {
  const text = JSON.stringify(body)
  response.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) })
  response.end(text)
}

async function gateway(policy, run) {
  const requests = []
  const server = createServer(async (request, response) => {
    const body = await bodyOf(request)
    requests.push({ body, authorization: request.headers.authorization, company: request.headers['x-company'] })
    const roles = Array.isArray(body.messages) ? body.messages.map(message => message.role) : []
    const rejected = [
      policy.developer === false && roles.includes('developer'),
      policy.maxCompletionTokens === false && Object.hasOwn(body, 'max_completion_tokens'),
      policy.maxTokens === false && Object.hasOwn(body, 'max_tokens'),
      policy.store === false && Object.hasOwn(body, 'store'),
      policy.reasoningEffort === false && Object.hasOwn(body, 'reasoning_effort'),
      policy.streamOptions === false && Object.hasOwn(body, 'stream_options'),
    ].some(Boolean)
    if (rejected) return json(response, 400, { error: { type: 'invalid_request_error', code: 'unsupported_field' } })
    if (body.stream === true) {
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.end('data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":"OK"}}]}\n\ndata: [DONE]\n\n')
      return
    }
    json(response, 200, {
      object: 'chat.completion',
      choices: [{ message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
    })
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  try {
    return await run(`http://127.0.0.1:${address.port}/v1`, requests)
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
}

test('proposes the minimal legacy-gateway profile without exposing secrets', async () => {
  await gateway({ developer: false, maxCompletionTokens: false, streamOptions: false }, async (baseURL, requests) => {
    const report = await probeDialect({
      baseURL,
      model: 'strict-model',
      apiKey: 'fixture-api-key',
      headers: { 'x-company': 'private-tenant' },
    })
    assert.equal(report.status, 'ready')
    assert.deepEqual(report.proposal, {
      maxTokensField: 'max_tokens',
      supportsDeveloperRole: false,
      supportsUsageInStreaming: false,
    })
    assert.equal(report.requestBudget.used, 10)
    assert(requests.every(request => request.authorization === 'Bearer fixture-api-key'))
    assert(requests.every(request => request.company === 'private-tenant'))
    const serialized = JSON.stringify(report)
    assert(!serialized.includes('fixture-api-key'))
    assert(!serialized.includes('private-tenant'))
    assert(!serialized.includes('Reply with exactly OK'))
  })
})

test('isolates store and reasoning fields', async () => {
  await gateway({ store: false, reasoningEffort: false }, async (baseURL) => {
    const report = await probeDialect({ baseURL, model: 'strict-model' })
    assert.equal(report.status, 'ready')
    assert.deepEqual(report.proposal, {
      supportsStore: false,
      supportsReasoningEffort: false,
    })
  })
})

test('returns no proposal for a permissive endpoint', async () => {
  await gateway({}, async (baseURL) => {
    const report = await probeDialect({ baseURL, model: 'permissive-model' })
    assert.equal(report.status, 'ready')
    assert.deepEqual(report.proposal, {})
  })
})

test('blocks safely when neither bounded token field is accepted', async () => {
  await gateway({ maxTokens: false, maxCompletionTokens: false }, async (baseURL) => {
    const report = await probeDialect({ baseURL, model: 'unknown-dialect' })
    assert.equal(report.status, 'blocked')
    assert.equal(report.blockedReason, 'base-request-shape-unresolved')
    assert.equal(report.requestBudget.used, 2)
    assert.deepEqual(report.proposal, {})
  })
})

test('honors cancellation before issuing another probe request', async () => {
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    probeDialect({ baseURL: 'http://127.0.0.1:9/v1', model: 'cancelled-model', signal: controller.signal }),
    /probe-cancelled/,
  )
})
