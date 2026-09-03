import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import {
  addHouseholdMember,
  createHousehold,
  deleteHousehold,
  getHouseholdMembers,
  getMyHouseholds,
  leaveHousehold,
  type Household,
  type HouseholdMember,
} from '../lib/households'
import { getFriendState, type FriendPerson } from '../lib/friends'

function HouseholdCard({
  household,
  myId,
  friends,
  onChange,
}: {
  household: Household
  myId: string
  friends: FriendPerson[]
  onChange: () => void
}) {
  const [members, setMembers] = useState<HouseholdMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [addId, setAddId] = useState('')

  useEffect(() => {
    let active = true
    getHouseholdMembers(household.id)
      .then((m) => active && setMembers(m))
      .catch(() => active && setMembers([]))
    return () => {
      active = false
    }
  }, [household.id])

  const isOwner = household.role === 'owner'
  const memberIds = new Set((members ?? []).map((m) => m.userId))
  const addable = friends.filter((f) => !memberIds.has(f.id))

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      const m = await getHouseholdMembers(household.id)
      setMembers(m)
      onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^\w+: /, '') : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rb-friend-row rb-household-card">
      <div className="rb-stack rb-stack--tight" style={{ width: '100%' }}>
        <strong>
          {household.name} <span className="rb-muted">· {household.role}</span>
        </strong>

        {members === null ? (
          <p className="rb-muted">Loading…</p>
        ) : (
          <ul className="rb-friend-list">
            {members.map((m) => (
              <li key={m.userId} className="rb-friend-row">
                <span>
                  {m.userId === myId ? 'You' : m.displayName}{' '}
                  <span className="rb-muted">· {m.role}</span>
                </span>
                {isOwner && m.userId !== myId && (
                  <button
                    type="button"
                    className="rb-button rb-button--ghost"
                    disabled={busy}
                    onClick={() => run(() => leaveHousehold(household.id, m.userId))}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {isOwner && addable.length > 0 && (
          <div className="rb-form-actions">
            <select className="rb-field" value={addId} onChange={(e) => setAddId(e.target.value)}>
              <option value="">Add a friend…</option>
              {addable.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.displayName}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rb-button"
              disabled={busy || !addId}
              onClick={() =>
                run(async () => {
                  await addHouseholdMember(household.id, addId)
                  setAddId('')
                })
              }
            >
              Add
            </button>
          </div>
        )}

        {error && <p className="rb-error">{error}</p>}

        <div className="rb-form-actions">
          {isOwner ? (
            <button
              type="button"
              className="rb-button rb-button--ghost rb-button--danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Delete "${household.name}"? This can’t be undone.`))
                  run(() => deleteHousehold(household.id))
              }}
            >
              Delete household
            </button>
          ) : (
            <button
              type="button"
              className="rb-button rb-button--ghost"
              disabled={busy}
              onClick={() => run(() => leaveHousehold(household.id, myId))}
            >
              Leave
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

export function Households() {
  const { user } = useAuth()
  const myId = user?.id ?? ''

  const [households, setHouseholds] = useState<Household[] | null>(null)
  const [friends, setFriends] = useState<FriendPerson[]>([])
  const [nonce, setNonce] = useState(0)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!myId) return
    let active = true
    Promise.all([getMyHouseholds(myId), getFriendState(myId)])
      .then(([hh, fs]) => {
        if (!active) return
        setHouseholds(hh)
        setFriends(fs.friends.map((f) => f.person))
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load')
      })
    return () => {
      active = false
    }
  }, [myId, nonce])

  const reload = () => setNonce((n) => n + 1)

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || creating) return
    setCreating(true)
    setError(null)
    try {
      await createHousehold(name)
      setName('')
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^\w+: /, '') : 'Couldn’t create.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="rb-stack" style={{ maxWidth: 560 }}>
      <Link to="/" className="rb-detail-back">
        <span aria-hidden="true">←</span> Plan
      </Link>
      <h1>Households</h1>
      <p className="rb-muted">
        A household shares a week plan. Members propose recipes and vote from the{' '}
        <Link to="/">calendar</Link>.
      </p>

      <form className="rb-form-actions" onSubmit={create}>
        <input
          className="rb-field"
          placeholder="New household name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="rb-button" type="submit" disabled={creating || !name.trim()}>
          {creating ? 'Creating…' : 'Create'}
        </button>
      </form>

      {error && <p className="rb-error">{error}</p>}

      {households === null ? (
        <p className="rb-muted">Loading…</p>
      ) : households.length === 0 ? (
        <p className="rb-muted">No households yet. Create one above and add your friends.</p>
      ) : (
        <div className="rb-stack">
          {households.map((h) => (
            <HouseholdCard key={h.id} household={h} myId={myId} friends={friends} onChange={reload} />
          ))}
        </div>
      )}
    </div>
  )
}
