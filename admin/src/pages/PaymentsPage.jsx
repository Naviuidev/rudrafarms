import { useState } from 'react'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import Button from '@brand/components/Button.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { savePaymentConfig } from '../api/paymentsApi.js'

const emptyConfig = {
  activeMode: 'sandbox',
  sandbox: { keyId: '', hasSecret: false, source: '' },
  production: { keyId: '', hasSecret: false, source: '' },
}

export default function PaymentsPage({ password, initialConfig }) {
  const [mode, setMode] = useState(initialConfig?.activeMode === 'production' ? 'production' : 'sandbox')
  const [config, setConfig] = useState(initialConfig || emptyConfig)
  const [keyId, setKeyId] = useState((initialConfig?.[initialConfig?.activeMode === 'production' ? 'production' : 'sandbox'] || emptyConfig.sandbox).keyId || '')
  const [keySecret, setKeySecret] = useState('')
  const [formError, setFormError] = useState('')
  const [savedNote, setSavedNote] = useState('')
  const [busy, setBusy] = useState(false)

  function applyMode(nextConfig, nextMode) {
    const section = nextConfig[nextMode] || emptyConfig.sandbox
    setMode(nextMode)
    setKeyId(section.keyId || '')
    setKeySecret('')
    setFormError('')
    setSavedNote('')
  }

  async function save(event) {
    event.preventDefault()
    setFormError('')
    setSavedNote('')
    setBusy(true)
    try {
      const next = await savePaymentConfig({
        password,
        mode,
        keyId: keyId.trim(),
        keySecret,
      })
      setConfig(next || emptyConfig)
      applyMode(next || emptyConfig, mode)
      setSavedNote(mode === 'production' ? 'Production keys are now used at checkout.' : 'Sandbox keys are now used at checkout.')
    } catch (error) {
      setFormError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const section = config[mode] || emptyConfig.sandbox
  const liveLabel = config.activeMode === 'production' ? 'production' : 'sandbox'

  return (
    <>
      <DocumentTitle title="Config payment" />
      <div className="page-heading">
        <p className="eyebrow">Razorpay</p>
        <h1>Config payment</h1>
        <p>Choose sandbox or production and save the Razorpay keys used at checkout.</p>
      </div>
      <form className="panel settings-form developer-sheet pay-config" onSubmit={save} noValidate>
        <p className="muted">Checkout is collecting with {liveLabel} keys.</p>
        <div className="pay-modes" role="group" aria-label="Razorpay environment">
          <button type="button" className="pay-mode" aria-pressed={mode === 'sandbox'} onClick={() => applyMode(config, 'sandbox')}>
            Sandbox
          </button>
          <button type="button" className="pay-mode" aria-pressed={mode === 'production'} onClick={() => applyMode(config, 'production')}>
            Production
          </button>
        </div>
        <TextField
          id="razorpay-key-id"
          label="Key ID"
          autoComplete="off"
          required
          value={keyId}
          hint={mode === 'sandbox' ? 'Starts with rzp_test_.' : 'Starts with rzp_live_.'}
          onChange={(event) => setKeyId(event.target.value)}
        />
        <TextField
          id="razorpay-key-secret"
          label="Key secret"
          type="password"
          autoComplete="new-password"
          required={!section.hasSecret}
          value={keySecret}
          hint={section.hasSecret ? 'Leave blank to keep the saved secret.' : 'From Razorpay → API Keys.'}
          onChange={(event) => setKeySecret(event.target.value)}
        />
        {formError ? <p className="field__error" role="alert">{formError}</p> : null}
        {savedNote ? <p className="pay-config__note">{savedNote}</p> : null}
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : mode === 'production' ? 'Save production' : 'Save sandbox'}
        </Button>
      </form>
    </>
  )
}
