window.__ModuleLoader__.load({
  id: 'dsh-provider-passport',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    var React = require('react')

    var CSS = [
      '.dpp-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none}',
      '.dpp-head{appearance:none;width:100%;border:0;background:transparent;color:inherit;text-align:left;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;border-radius:12px}',
      '.dpp-head:focus-visible,.dpp-select:focus-visible,.dpp-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.dpp-titleWrap{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}',
      '.dpp-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.dpp-desc,.dpp-note{font-size:12px;line-height:1.55;color:var(--dsw-alias-label-tertiary)}',
      '.dpp-body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding:14px 0 10px;display:flex;flex-direction:column;gap:12px}',
      '.dpp-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.dpp-field{display:flex;flex-direction:column;gap:5px}',
      '.dpp-label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}',
      '.dpp-select{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);border-radius:8px;padding:7px 10px;font:inherit;font-size:13px}',
      '.dpp-plan{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:5px}',
      '.dpp-check{display:flex;align-items:flex-start;gap:8px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary)}',
      '.dpp-check input{margin-top:3px}',
      '.dpp-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}',
      '.dpp-btn{appearance:none;border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}',
      '.dpp-btn[disabled]{opacity:.5;cursor:default}',
      '.dpp-primary{border:1px solid transparent;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}',
      '.dpp-secondary{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary)}',
      '.dpp-result{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:8px}',
      '.dpp-result[data-kind=ok]{border-color:var(--dsw-alias-state-success-primary)}',
      '.dpp-result[data-kind=error]{border-color:var(--dsw-alias-state-error-primary)}',
      '.dpp-message{margin:0;border-radius:8px;padding:8px 10px}',
      '.dpp-message[data-kind=success]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,transparent);color:var(--dsw-alias-state-success-primary)}',
      '.dpp-message[data-kind=error]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);color:var(--dsw-alias-state-error-primary)}',
      '.dpp-status{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.dpp-grid{display:grid;grid-template-columns:minmax(130px,1fr) minmax(110px,.8fr);gap:5px 12px;font-size:12px}',
      '.dpp-key{color:var(--dsw-alias-label-secondary)}',
      '.dpp-value{color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow-wrap:anywhere}',
      '.dpp-pill{display:inline-block;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:1px 8px;font-size:11px;color:var(--dsw-alias-label-secondary)}',
      '@media(max-width:620px){.dpp-row{grid-template-columns:1fr}.dpp-grid{grid-template-columns:1fr}}',
    ].join('')
    var tagId = 'dsh-provider-passport/card.css'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {
      var style = document.createElement('style')
      style.dataset.pluginCss = tagId
      style.textContent = CSS
      document.head.appendChild(style)
    }

    var API = {
      list: '/api/dsh-provider-passport/list',
      probe: '/api/dsh-provider-passport/probe',
      cancel: '/api/dsh-provider-passport/cancel',
      apply: '/api/dsh-provider-passport/apply',
      rollback: '/api/dsh-provider-passport/rollback',
    }
    var VERSION = '0.1.0-preview.2'
    var zh = {
      title: '提供方兼容护照',
      description: '在第一次工作失败前，找出自定义模型接口与 Harness 请求格式的差异。',
      provider: '提供方', model: '模型', choose: '请选择', noRoutes: '没有可预检的 OpenAI Chat Completions 自定义模型。',
      protocolTitle: '协议安全边界', protocolNotice: '只显示设置中显式声明 api: openai-completions 的路由；已安全跳过 {ambiguous} 条协议无法证明的路由和 {other} 条其他协议路由。',
      planTitle: '运行前确认', plan: '将发送最多 10 次固定小请求，每次最多 1 个输出 token、单次最多等待 12 秒；不会上传你的文件或会话，但可能产生少量 API 费用。',
      confirm: '我确认对这个模型运行兼容预检。', run: '运行预检', running: '正在预检…', cancel: '取消预检', cancelling: '正在取消…', cancelled: '预检已取消，没有写入任何配置。', apply: '应用并用 Harness 验证', applying: '正在应用并验证…', rollback: '撤销本次修改',
      noChange: '接口接受当前测试的请求格式，不建议修改配置。', proposal: '建议的最小配置', ready: '预检完成', partial: '部分结果无法判定', blocked: '预检已安全停止',
      blockedHint: '基础请求格式仍无法确定；可能是协议不匹配或提供方管理的行为。插件没有写入配置，也不会建议 Harness 标记为不可配置的字段。',
      proposalRefused: 'Harness 拒绝了这组兼容字段；设置保持不变，请重新预检或提交脱敏报告。', protocolChanged: '路由协议或设置已经变化；没有写入配置，请重新预检。',
      verified: '配置已应用，并通过真实 Harness 运行时验证。', rolledBack: '已恢复预检前的模型配置。', expired: '结果已过期，请重新预检。', copyReport: '复制脱敏报告', copied: '脱敏报告已复制，可以粘贴到 GitHub Issue。', copyFailed: '无法复制报告，请检查浏览器剪贴板权限。',
    }
    var en = {
      title: 'Provider compatibility passport',
      description: 'Find custom-provider request-shape differences before the first Harness task fails.',
      provider: 'Provider', model: 'Model', choose: 'Choose', noRoutes: 'No custom OpenAI Chat Completions models are available.',
      protocolTitle: 'Protocol safety boundary', protocolNotice: 'Only routes that explicitly declare api: openai-completions are shown. Safely skipped {ambiguous} route(s) whose protocol cannot be proven and {other} route(s) using another protocol.',
      planTitle: 'Confirm before running', plan: 'Sends at most 10 fixed small requests with at most 1 output token each and a 12-second per-request timeout. No files or conversation data are sent, but small API charges may apply.',
      confirm: 'I confirm this compatibility preflight for the selected model.', run: 'Run preflight', running: 'Probing…', cancel: 'Cancel preflight', cancelling: 'Cancelling…', cancelled: 'Preflight cancelled; no configuration was written.', apply: 'Apply and verify through Harness', applying: 'Applying and verifying…', rollback: 'Undo this change',
      noChange: 'The endpoint accepted the tested request shapes; no configuration change is proposed.', proposal: 'Minimal proposed profile', ready: 'Preflight complete', partial: 'Some results were inconclusive', blocked: 'Preflight stopped safely',
      blockedHint: 'The base request shape is still unresolved. This may be a protocol mismatch or provider-managed behavior. No settings were written, and the plugin never proposes fields that Harness marks as non-configurable.',
      proposalRefused: 'Harness refused this compatibility proposal. Settings are unchanged; rerun the preflight or submit a redacted report.', protocolChanged: 'The route protocol or settings changed. Nothing was written; rerun the preflight.',
      verified: 'The profile was applied and verified through the real Harness runtime.', rolledBack: 'The model configuration was restored.', expired: 'This result expired. Run the preflight again.', copyReport: 'Copy redacted report', copied: 'The redacted report was copied. Paste it into a GitHub issue.', copyFailed: 'The report could not be copied. Check browser clipboard permission.',
    }

    function post(url, body) {
      return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }).then(function read(response) {
        return response.json().catch(function empty() { return {} }).then(function parsed(payload) {
          if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'HTTP ' + response.status)
          return payload
        })
      })
    }

    function labels(t) {
      if (typeof t !== 'function') return zh
      var out = {}
      Object.keys(zh).forEach(function each(key) { out[key] = t(key) })
      return out
    }

    function safeOutcome(value) {
      if (!value || typeof value !== 'object') return {}
      var out = {}
      ;['outcome', 'httpStatus', 'errorType', 'errorCode'].forEach(function copy(key) {
        if (value[key] !== undefined) out[key] = value[key]
      })
      return out
    }

    function shareableEvidence(report, verified) {
      return {
        schemaVersion: 'dsh.provider-passport.community.v1',
        plugin: { name: 'dsh-provider-passport', version: VERSION },
        status: report.status,
        ...(report.blockedReason ? { blockedReason: report.blockedReason } : {}),
        compatibilityPolicy: report.compatibilityPolicy || {},
        proposal: report.proposal || {},
        probes: (report.probes || []).map(function redact(probe) {
          return { id: probe.id, verdict: probe.verdict, control: safeOutcome(probe.control), candidate: safeOutcome(probe.candidate) }
        }),
        requestBudget: report.requestBudget,
        harnessVerification: verified ? 'passed' : 'not-run',
        privacy: 'No endpoint, model id, credentials, headers, prompts, response bodies, or model output are included.',
      }
    }

    function displayError(code, text) {
      if (code === 'proposal-refused-no-write') return text.proposalRefused
      if (code === 'protocol-changed-rerun-probe') return text.protocolChanged
      return code
    }

    function protocolNotice(data, text) {
      var excluded = data && data.protocolGuard && data.protocolGuard.excludedRoutes || {}
      return text.protocolNotice
        .replace('{ambiguous}', String(excluded.apiNotExplicit || 0))
        .replace('{other}', String(excluded.unsupportedApi || 0))
    }

    function PassportCard(props) {
      var text = labels(props.t)
      var openState = React.useState(false), open = openState[0], setOpen = openState[1]
      var dataState = React.useState({ providers: [], requestPlan: {}, protocolGuard: {} }), data = dataState[0], setData = dataState[1]
      var providerState = React.useState(''), provider = providerState[0], setProvider = providerState[1]
      var modelState = React.useState(''), model = modelState[0], setModel = modelState[1]
      var confirmState = React.useState(false), confirmed = confirmState[0], setConfirmed = confirmState[1]
      var busyState = React.useState(''), busy = busyState[0], setBusy = busyState[1]
      var resultState = React.useState(null), result = resultState[0], setResult = resultState[1]
      var messageState = React.useState(''), message = messageState[0], setMessage = messageState[1]
      var rollbackState = React.useState(''), rollbackId = rollbackState[0], setRollbackId = rollbackState[1]
      var probeNonce = React.useRef(0)

      function refresh() {
        return post(API.list, {}).then(function done(next) {
          if (!next || next.ok !== true) return
          setData(next)
          if (!provider && next.providers && next.providers[0]) {
            setProvider(next.providers[0].id)
            if (next.providers[0].models && next.providers[0].models[0]) setModel(next.providers[0].models[0].id)
          }
        })
      }
      React.useEffect(function load() { if (open) refresh().catch(function ignore() {}) }, [open])

      var selectedProvider = (data.providers || []).find(function find(item) { return item.id === provider })
      var models = selectedProvider ? selectedProvider.models || [] : []
      function changeProvider(event) {
        var id = event.target.value
        setProvider(id)
        var next = (data.providers || []).find(function find(item) { return item.id === id })
        setModel(next && next.models && next.models[0] ? next.models[0].id : '')
        setResult(null); setMessage(''); setRollbackId(''); setConfirmed(false)
      }
      function runProbe() {
        var nonce = ++probeNonce.current
        setBusy('probe'); setMessage(''); setResult(null); setRollbackId('')
        post(API.probe, { provider: provider, model: model, confirmed: true }).then(function done(next) {
          if (nonce !== probeNonce.current) return
          setBusy('')
          if (!next || next.ok !== true) { setMessage(displayError((next && next.error) || 'probe-failed', text)); return }
          setResult(next.report)
        }, function fail(error) { if (nonce === probeNonce.current) { setBusy(''); setMessage(error.message || String(error)) } })
      }
      function cancelProbe() {
        ++probeNonce.current
        setBusy('cancel'); setMessage('')
        post(API.cancel, { provider: provider, model: model }).then(function done(next) {
          setBusy('')
          if (!next || next.ok !== true) { setMessage((next && next.error) || 'cancel-failed'); return }
          setMessage(text.cancelled); setResult(null)
        }, function fail(error) { setBusy(''); setMessage(error.message || String(error)) })
      }
      function applyProfile() {
        setBusy('apply'); setMessage('')
        post(API.apply, { reportId: result && result.reportId }).then(function done(next) {
          setBusy('')
          if (!next || next.ok !== true) { setMessage(displayError((next && next.error) || 'apply-failed', text)); return }
          setMessage(text.verified); setRollbackId(next.rollbackId || ''); refresh().catch(function ignore() {})
        }, function fail(error) { setBusy(''); setMessage(error.message || String(error)) })
      }
      function rollback() {
        setBusy('rollback'); setMessage('')
        post(API.rollback, { rollbackId: rollbackId }).then(function done(next) {
          setBusy('')
          if (!next || next.ok !== true) { setMessage((next && next.error) || text.expired); return }
          setMessage(text.rolledBack); setRollbackId(''); setResult(null); refresh().catch(function ignore() {})
        }, function fail(error) { setBusy(''); setMessage(error.message || String(error)) })
      }
      function copyEvidence() {
        var value = JSON.stringify(shareableEvidence(result, !!rollbackId), null, 2)
        function copied() { setMessage(text.copied) }
        function failed() { setMessage(text.copyFailed) }
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(value).then(copied, failed)
          return
        }
        try {
          var textarea = document.createElement('textarea')
          textarea.value = value
          textarea.setAttribute('readonly', '')
          textarea.style.position = 'fixed'
          textarea.style.opacity = '0'
          document.body.appendChild(textarea)
          textarea.select()
          var ok = document.execCommand('copy')
          textarea.remove()
          if (ok) copied()
          else failed()
        } catch (error) { failed() }
      }

      var proposal = result && result.proposal ? result.proposal : {}
      var proposalKeys = Object.keys(proposal)
      var resultLabel = result ? (result.status === 'blocked' ? text.blocked : result.status === 'partial' ? text.partial : text.ready) : ''
      var excluded = data && data.protocolGuard && data.protocolGuard.excludedRoutes || {}
      var excludedCount = (excluded.apiNotExplicit || 0) + (excluded.unsupportedApi || 0)
      return React.createElement('li', { className: 'dpp-card' },
        React.createElement('button', { type: 'button', className: 'dpp-head', 'aria-expanded': open, onClick: function toggle() { setOpen(!open) } },
          React.createElement('span', { className: 'dpp-titleWrap' },
            React.createElement('span', { className: 'dpp-title' }, text.title),
            React.createElement('span', { className: 'dpp-desc' }, text.description)),
          React.createElement('span', { 'aria-hidden': true }, open ? '−' : '+')),
        open ? React.createElement('div', { className: 'dpp-body' },
          (data.providers || []).length === 0 ? React.createElement('p', { className: 'dpp-note' }, text.noRoutes) : null,
          excludedCount > 0 ? React.createElement('div', { className: 'dpp-plan' },
            React.createElement('strong', { className: 'dpp-status' }, text.protocolTitle),
            React.createElement('span', { className: 'dpp-note' }, protocolNotice(data, text))) : null,
          (data.providers || []).length > 0 ? React.createElement('div', { className: 'dpp-row' },
            React.createElement('label', { className: 'dpp-field' }, React.createElement('span', { className: 'dpp-label' }, text.provider),
              React.createElement('select', { className: 'dpp-select', value: provider, onChange: changeProvider, disabled: !!busy || !!rollbackId },
                (data.providers || []).map(function item(entry) { return React.createElement('option', { key: entry.id, value: entry.id }, entry.displayName || entry.id) }))),
            React.createElement('label', { className: 'dpp-field' }, React.createElement('span', { className: 'dpp-label' }, text.model),
              React.createElement('select', { className: 'dpp-select', value: model, onChange: function change(event) { setModel(event.target.value); setResult(null); setMessage(''); setRollbackId(''); setConfirmed(false) }, disabled: !!busy || !!rollbackId },
                models.map(function item(entry) { return React.createElement('option', { key: entry.id, value: entry.id }, entry.name || entry.id) }))),
          ) : null,
          (data.providers || []).length > 0 ? React.createElement('div', { className: 'dpp-plan' },
            React.createElement('strong', { className: 'dpp-status' }, text.planTitle),
            React.createElement('span', { className: 'dpp-note' }, text.plan),
            React.createElement('label', { className: 'dpp-check' }, React.createElement('input', { type: 'checkbox', checked: confirmed, disabled: !!busy || !!rollbackId, onChange: function change(event) { setConfirmed(!!event.target.checked) } }), text.confirm)) : null,
          result ? React.createElement('section', { className: 'dpp-result', 'data-kind': result.status === 'ready' ? 'ok' : result.status === 'blocked' ? 'error' : 'warn' },
            React.createElement('div', { className: 'dpp-status' }, resultLabel, ' ', React.createElement('span', { className: 'dpp-pill' }, result.requestBudget.used + '/' + result.requestBudget.planned)),
            result.status === 'blocked' ? React.createElement('p', { className: 'dpp-note' }, text.blockedHint) : null,
            proposalKeys.length === 0 ? React.createElement('p', { className: 'dpp-note' }, text.noChange) : React.createElement(React.Fragment, null,
              React.createElement('div', { className: 'dpp-label' }, text.proposal),
              React.createElement('div', { className: 'dpp-grid' }, proposalKeys.map(function row(key) {
                return React.createElement(React.Fragment, { key: key }, React.createElement('span', { className: 'dpp-key' }, key), React.createElement('span', { className: 'dpp-value' }, String(proposal[key])))
              })))) : null,
          message ? React.createElement('p', { className: 'dpp-note dpp-message', 'data-kind': message === text.verified || message === text.rolledBack || message === text.cancelled || message === text.copied ? 'success' : 'error', role: 'status' }, message) : null,
          React.createElement('div', { className: 'dpp-actions' },
            busy === 'probe' || busy === 'cancel' ? React.createElement('button', { type: 'button', className: 'dpp-btn dpp-secondary', disabled: busy === 'cancel', onClick: cancelProbe }, busy === 'cancel' ? text.cancelling : text.cancel) : null,
            result ? React.createElement('button', { type: 'button', className: 'dpp-btn dpp-secondary', disabled: !!busy, onClick: copyEvidence }, text.copyReport) : null,
            rollbackId ? React.createElement('button', { type: 'button', className: 'dpp-btn dpp-secondary', disabled: !!busy, onClick: rollback }, text.rollback) : null,
            !rollbackId && result && proposalKeys.length > 0 && result.status !== 'blocked' && selectedProvider && selectedProvider.writable
              ? React.createElement('button', { type: 'button', className: 'dpp-btn dpp-secondary', disabled: !!busy, onClick: applyProfile }, busy === 'apply' ? text.applying : text.apply) : null,
            React.createElement('button', { type: 'button', className: 'dpp-btn dpp-primary', disabled: !!busy || !!rollbackId || !confirmed || !provider || !model, onClick: runProbe }, busy === 'probe' || busy === 'cancel' ? text.running : text.run)),
        ) : null)
    }

    var NS = 'provider-passport'
    var inject = ['slots', 'locale']
    function apply(ctx) {
      ctx.effect(function locale() { return ctx.locale.register(NS, { zh: zh, en: en }) }, 'provider-passport:locale')
      ctx.slots.inject('settings.plugin.item', function injectCard() {
        return ctx.slots.register({ name: 'settings.plugin.item', key: 'llm-pi-ai', order: 35, locale: NS, inject: function inject() { return {} } }, PassportCard)
      })
    }
    exports.apply = apply
    exports.inject = inject
    exports.__test = { shareableEvidence: shareableEvidence }
    return module.exports
  },
})
