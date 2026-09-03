import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import {
  acceptFriendRequest,
  getFriendState,
  removeFriendship,
  sendFriendRequest,
  type FriendState,
} from '../lib/friends'

export function Friends() {
  const { user } = useAuth()
  const myId = user?.id ?? ''

  const [state, setState] = useState<FriendState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!myId) return
    let active = true
    getFriendState(myId)
      .then((s) => {
        if (active) {
          setState(s)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load friends')
      })
    return () => {
      active = false
    }
  }, [myId, nonce])

  const reload = () => setNonce((n) => n + 1)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || sending) return
    setSending(true)
    setSendMsg(null)
    try {
      await sendFriendRequest(email)
      setEmail('')
      setSendMsg('Request sent.')
      reload()
    } catch (err) {
      setSendMsg(err instanceof Error ? err.message.replace(/^send_friend_request: /, '') : 'Couldn’t send.')
    } finally {
      setSending(false)
    }
  }

  async function act(id: string, fn: () => Promise<void>) {
    setBusyId(id)
    setError(null)
    try {
      await fn()
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rb-stack" style={{ maxWidth: 520 }}>
      <div className="rb-list-head">
        <h1>Friends</h1>
        <Link to="/households" className="rb-linklike">
          Households →
        </Link>
      </div>

      <form className="rb-stack rb-stack--tight" onSubmit={submit}>
        <label className="rb-label">
          Add a friend by email
          <input
            className="rb-field"
            type="email"
            placeholder="friend@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setSendMsg(null)
            }}
          />
        </label>
        <div className="rb-form-actions">
          <button className="rb-button" type="submit" disabled={sending || !email.trim()}>
            {sending ? 'Sending…' : 'Send request'}
          </button>
          {sendMsg && <span className="rb-muted">{sendMsg}</span>}
        </div>
      </form>

      {error && <p className="rb-error">{error}</p>}

      {state === null ? (
        <p className="rb-muted">Loading…</p>
      ) : (
        <>
          {state.incoming.length > 0 && (
            <section className="rb-stack rb-stack--tight">
              <h2>Requests</h2>
              <ul className="rb-friend-list">
                {state.incoming.map((f) => (
                  <li key={f.id} className="rb-friend-row">
                    <span>{f.person.displayName}</span>
                    <span className="rb-friend-row__actions">
                      <button
                        type="button"
                        className="rb-button"
                        disabled={busyId === f.id}
                        onClick={() => act(f.id, () => acceptFriendRequest(f.id))}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="rb-button rb-button--ghost"
                        disabled={busyId === f.id}
                        onClick={() => act(f.id, () => removeFriendship(f.id))}
                      >
                        Decline
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rb-stack rb-stack--tight">
            <h2>Your friends</h2>
            {state.friends.length === 0 ? (
              <p className="rb-muted">No friends yet. Send a request above.</p>
            ) : (
              <ul className="rb-friend-list">
                {state.friends.map((f) => (
                  <li key={f.id} className="rb-friend-row">
                    <Link to={`/friends/${f.person.id}`}>{f.person.displayName}</Link>
                    <button
                      type="button"
                      className="rb-button rb-button--ghost"
                      disabled={busyId === f.id}
                      onClick={() => act(f.id, () => removeFriendship(f.id))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {state.outgoing.length > 0 && (
            <section className="rb-stack rb-stack--tight">
              <h2>Pending</h2>
              <ul className="rb-friend-list">
                {state.outgoing.map((f) => (
                  <li key={f.id} className="rb-friend-row">
                    <span className="rb-muted">{f.person.displayName} — awaiting reply</span>
                    <button
                      type="button"
                      className="rb-button rb-button--ghost"
                      disabled={busyId === f.id}
                      onClick={() => act(f.id, () => removeFriendship(f.id))}
                    >
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
