import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

test('client card is keyed to the settings namespace dispatched by the Harness UI', async () => {
  let declaration
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(value) { declaration = value } } },
  })
  assert.equal(declaration.id, 'dsh-provider-passport')

  const plugin = declaration.factory(name => {
    assert.equal(name, 'react')
    return {}
  })
  let registration
  plugin.apply({
    effect(setup) { return setup() },
    locale: { register() { return () => {} } },
    slots: {
      inject(name, setup) {
        assert.equal(name, 'settings.plugin.item')
        return setup()
      },
      register(options) {
        registration = options
        return () => {}
      },
    },
  })

  assert.equal(registration.key, 'llm-pi-ai')
  assert.equal(registration.locale, 'provider-passport')
  assert.match(source, /dsh\.provider-passport\.community\.v1/)
  assert.match(source, /No endpoint, model id, credentials, headers, prompts, response bodies, or model output/)
  assert.doesNotMatch(source, /target:\s*report\.target/)

  const evidence = plugin.__test.shareableEvidence({
    schemaVersion: 'dsh.provider-passport.v1',
    reportId: 'private-report-id',
    status: 'ready',
    target: { baseURL: 'https://private.example/v1', model: 'private-model' },
    proposal: { supportsDeveloperRole: false },
    probes: [{
      id: 'developer-role',
      verdict: 'candidate-rejected',
      control: { outcome: 'accepted', httpStatus: 200, elapsedMs: 12, responseBody: 'secret' },
      candidate: { outcome: 'rejected', httpStatus: 400, errorCode: 'unsupported_field', credential: 'secret' },
    }],
    requestBudget: { planned: 10, used: 10, userDataSent: false },
  }, true)
  const serialized = JSON.stringify(evidence)
  assert.equal(evidence.harnessVerification, 'passed')
  assert.equal(evidence.plugin.version, '0.1.0-preview.1')
  assert(!serialized.includes('private.example'))
  assert(!serialized.includes('private-model'))
  assert(!serialized.includes('private-report-id'))
  assert(!serialized.includes('responseBody'))
  assert(!/"credential":/u.test(serialized))
  assert(!serialized.includes('elapsedMs'))
})
