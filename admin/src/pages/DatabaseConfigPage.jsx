import { useState } from 'react'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import Button from '@brand/components/Button.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { saveDatabaseConfig } from '../api/databaseApi.js'

const emptyProfile = { host: '', port: '3306', name: '', user: '', hasPassword: false }

const emptyConfig = {
  activeMode: 'local',
  local: emptyProfile,
  production: emptyProfile,
}

export default function DatabaseConfigPage({ password, initialConfig }) {
  const [mode, setMode] = useState(initialConfig?.activeMode === 'production' ? 'production' : 'local')
  const [config, setConfig] = useState(initialConfig || emptyConfig)
  const starting = (initialConfig?.[initialConfig?.activeMode === 'production' ? 'production' : 'local']) || emptyProfile
  const [host, setHost] = useState(starting.host || '')
  const [port, setPort] = useState(starting.port || '3306')
  const [name, setName] = useState(starting.name || '')
  const [user, setUser] = useState(starting.user || '')
  const [dbPassword, setDbPassword] = useState('')
  const [clearPassword, setClearPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const [savedNote, setSavedNote] = useState('')
  const [busy, setBusy] = useState(false)

  function applyMode(nextConfig, nextMode) {
    const section = nextConfig[nextMode] || emptyProfile
    setMode(nextMode)
    setHost(section.host || '')
    setPort(section.port || '3306')
    setName(section.name || '')
    setUser(section.user || '')
    setDbPassword('')
    setClearPassword(false)
    setFormError('')
    setSavedNote('')
  }

  async function save(event) {
    event.preventDefault()
    setFormError('')
    setSavedNote('')
    setBusy(true)
    try {
      const next = await saveDatabaseConfig({
        password,
        mode,
        host,
        port,
        name,
        user,
        dbPassword,
        clearPassword,
      })
      setConfig(next || emptyConfig)
      applyMode(next || emptyConfig, mode)
      const active = (next || emptyConfig).activeMode === 'production' ? 'production' : 'local'
      if (mode === 'production') {
        setSavedNote(active === 'production'
          ? 'Production database details are saved. This server uses them now.'
          : 'Production database details are saved. They are used when APP_ENV is production.')
      } else {
        setSavedNote(active === 'local'
          ? 'Localhost database details are saved. This computer uses them now.'
          : 'Localhost database details are saved. They are used when APP_ENV is local.')
      }
    } catch (error) {
      setFormError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const section = config[mode] || emptyProfile
  const activeLabel = config.activeMode === 'production' ? 'production' : 'localhost'

  return (
    <>
      <DocumentTitle title="DB config" />
      <div className="page-heading">
        <p className="eyebrow">Database</p>
        <h1>DB config</h1>
        <p>Save the localhost and production database. The running environment uses the matching set.</p>
      </div>
      <form className="panel settings-form developer-sheet pay-config" onSubmit={save} noValidate>
        <p className="muted">This {config.activeMode === 'production' ? 'server' : 'computer'} is using the {activeLabel} database.</p>
        <div className="pay-modes" role="group" aria-label="Database environment">
          <button type="button" className="pay-mode" aria-pressed={mode === 'local'} onClick={() => applyMode(config, 'local')}>
            Localhost
          </button>
          <button type="button" className="pay-mode" aria-pressed={mode === 'production'} onClick={() => applyMode(config, 'production')}>
            Production
          </button>
        </div>
        <TextField id="db-host" label="Host" autoComplete="off" required value={host} onChange={(event) => setHost(event.target.value)} />
        <TextField id="db-port" label="Port" autoComplete="off" required inputMode="numeric" value={port} onChange={(event) => setPort(event.target.value)} />
        <TextField id="db-name" label="Database name" autoComplete="off" required value={name} onChange={(event) => setName(event.target.value)} />
        <TextField id="db-user" label="Username" autoComplete="off" required value={user} onChange={(event) => setUser(event.target.value)} />
        <TextField
          id="db-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={clearPassword ? '' : dbPassword}
          disabled={clearPassword}
          hint={section.hasPassword ? 'Leave blank to keep the saved password.' : 'Leave blank when this database has no password.'}
          onChange={(event) => setDbPassword(event.target.value)}
        />
        {section.hasPassword ? (
          <label className="check-row">
            <input type="checkbox" checked={clearPassword} onChange={(event) => setClearPassword(event.target.checked)} />
            Clear the saved password
          </label>
        ) : null}
        {formError ? <p className="field__error" role="alert">{formError}</p> : null}
        {savedNote ? <p className="pay-config__note">{savedNote}</p> : null}
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : mode === 'production' ? 'Save production' : 'Save localhost'}
        </Button>
      </form>
    </>
  )
}
