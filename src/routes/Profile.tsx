import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../auth/useProfile'
import { updateMyDisplayName } from '../lib/profile'
import { supabase } from '../lib/supabase'

function DisplayNameForm({ initialName, onSaved }: { initialName: string; onSaved: () => void }) {
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateMyDisplayName(name)
      onSaved()
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="rb-stack rb-stack--tight" onSubmit={save}>
      <label className="rb-label">
        Display name
        <input
          className="rb-field"
          value={name}
          maxLength={60}
          placeholder="How friends will see you"
          onChange={(e) => {
            setName(e.target.value)
            setSaved(false)
          }}
        />
      </label>
      <p className="rb-muted" style={{ fontSize: 13 }}>
        Shown to friends once recipe sharing is on.
      </p>
      {error && <p className="rb-error">{error}</p>}
      <div className="rb-form-actions">
        <button className="rb-button" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="rb-muted">Saved.</span>}
      </div>
    </form>
  )
}

export function Profile() {
  const { user } = useAuth()
  const { profile, loading, refresh } = useProfile()

  return (
    <div className="rb-stack" style={{ maxWidth: 420 }}>
      <h1>Your account</h1>

      <label className="rb-label">
        Email
        <input className="rb-field" value={user?.email ?? ''} disabled />
      </label>

      {loading || !profile ? (
        <p className="rb-muted">Loading…</p>
      ) : (
        <DisplayNameForm key={profile.id} initialName={profile.display_name} onSaved={refresh} />
      )}

      <hr className="rb-rule" />

      <button
        type="button"
        className="rb-button rb-button--ghost"
        onClick={() => void supabase.auth.signOut()}
      >
        Sign out
      </button>
    </div>
  )
}
