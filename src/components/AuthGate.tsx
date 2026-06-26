import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { company } from '../config/company'

export default function AuthGate() {
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)

  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setNote('')
    try {
      if (mode === 'in') {
        await signIn(email, password)
      } else {
        const hasSession = await signUp(email, password)
        if (!hasSession) {
          setNote('Account created. Check your email to confirm, then sign in.')
          setMode('in')
        }
      }
    } catch {
      /* error shown from store */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand" style={{ color: company.brandColor }}>
          {company.name}
        </div>
        <div className="auth-sub">{company.tagline}</div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'in' ? 'active' : ''}
            onClick={() => { setMode('in'); clearError(); setNote('') }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'up' ? 'active' : ''}
            onClick={() => { setMode('up'); clearError(); setNote('') }}
          >
            Create account
          </button>
        </div>

        <label className="auth-field">
          <span>Email</span>
          <input type="email" value={email} required autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            required
            minLength={6}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <div className="auth-error">{error}</div>}
        {note && <div className="auth-note">{note}</div>}

        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>

        <div className="auth-foot">Your projects sync to the cloud and are private to your account.</div>
      </form>
    </div>
  )
}
