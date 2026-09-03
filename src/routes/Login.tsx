import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'

export function Login() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (!loading && session) {
    return <Navigate to="/" replace />
  }

  async function sendLink(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setStatus('error')
      setError(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="rb-center">
      <div className="rb-card">
        <h1>Recipe Book</h1>

        {status === 'sent' ? (
          <p className="rb-muted">
            Check <strong>{email}</strong> for a sign-in link. You can close this tab.
          </p>
        ) : (
          <form onSubmit={sendLink}>
            <p className="rb-muted" style={{ marginTop: 0 }}>
              Enter your email and we&rsquo;ll send you a one-time sign-in link.
            </p>
            <label htmlFor="email" className="rb-muted" style={{ fontSize: 14 }}>
              Email
            </label>
            <input
              id="email"
              className="rb-field"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ margin: '6px 0 16px' }}
            />
            <button
              className="rb-button"
              type="submit"
              disabled={status === 'sending'}
              style={{ width: '100%' }}
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            {status === 'error' && error && (
              <p className="rb-error" style={{ marginBottom: 0 }}>
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
