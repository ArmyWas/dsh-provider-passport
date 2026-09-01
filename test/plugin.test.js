import assert from 'node:assert/strict'
import test from 'node:test'

import { modelsWithProposal, verifyThroughHarness } from '../lib/index.js'

test('applies proposal only to the selected model and preserves other rows', () => {
  const before = [
    { id: 'one', name: 'One', compat: { supportsStore: true } },
    { id: 'two', name: 'Two' },
  ]
  const after = modelsWithProposal(before, 'one', { supportsStore: false, maxTokensField: 'max_tokens' })
  assert.deepEqual(after, [
    { id: 'one', name: 'One', compat: { supportsStore: false, maxTokensField: 'max_tokens' } },
    { id: 'two', name: 'Two' },
  ])
  assert.deepEqual(before, [
    { id: 'one', name: 'One', compat: { supportsStore: true } },
    { id: 'two', name: 'Two' },
  ])
})

test('real-runtime verifier accepts a terminal successful finish and sends fixed data only', async () => {
  let observed
  const llm = {
    async *stream(options) {
      observed = options
      yield { type: 'text-delta', text: 'OK' }
      yield { type: 'finish', reason: { kind: 'stop' } }
    },
  }
  const result = await verifyThroughHarness(llm, 'provider', 'model', 'high', 2_000)
  assert.deepEqual(result, { ok: true, finishReason: 'stop' })
  assert.equal(observed.provider, 'provider')
  assert.equal(observed.model, 'model')
  assert.equal(observed.maxTokens, 8)
  assert.equal(observed.system, 'You are a connectivity probe.')
  assert.equal(observed.messages[0].content[0].text, 'Reply with exactly OK.')
})

test('real-runtime verifier returns a redacted provider failure', async () => {
  const llm = {
    async *stream() {
      yield { type: 'finish', reason: { kind: 'error', failure: { code: 'INVALID_REQUEST', status: 400, message: 'contains private payload' } } }
    },
  }
  const result = await verifyThroughHarness(llm, 'provider', 'model', undefined, 2_000)
  assert.deepEqual(result, { ok: false, failure: { code: 'INVALID_REQUEST', status: 400 } })
  assert(!JSON.stringify(result).includes('private payload'))
})
