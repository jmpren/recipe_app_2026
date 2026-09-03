import { useEffect, useState } from 'react'
import { toISODate } from '../lib/dates'
import {
  getProposals,
  proposeMeal,
  removeProposal,
  scheduleProposal,
  unvoteProposal,
  voteProposal,
  type Proposal,
} from '../lib/households'
import { MEAL_SLOTS, type MealSlot } from '../lib/mealPlan'
import type { Recipe } from '../types'

const DAY_FMT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric' }

export function ProposalsPanel({
  householdId,
  weekStartISO,
  days,
  myId,
  myRecipes,
  onScheduled,
}: {
  householdId: string
  weekStartISO: string
  days: Date[]
  myId: string
  myRecipes: Recipe[]
  onScheduled: () => void
}) {
  const [proposals, setProposals] = useState<Proposal[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const [busy, setBusy] = useState(false)

  const [proposing, setProposing] = useState(false)
  const [search, setSearch] = useState('')
  const [schedulingId, setSchedulingId] = useState<string | null>(null)
  const [schedDay, setSchedDay] = useState(toISODate(days[0]))
  const [schedSlot, setSchedSlot] = useState<MealSlot>('dinner')

  useEffect(() => {
    let active = true
    getProposals(householdId, weekStartISO, myId)
      .then((p) => {
        if (!active) return
        setProposals(p)
        setError(null)
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load proposals')
      })
    return () => {
      active = false
    }
  }, [householdId, weekStartISO, myId, nonce])

  const reload = () => setNonce((n) => n + 1)

  async function run(fn: () => Promise<void>, refreshPlan = false) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      reload()
      if (refreshPlan) onScheduled()
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^\w+: /, '') : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const term = search.trim().toLowerCase()
  const proposedIds = new Set((proposals ?? []).map((p) => p.recipeId))
  const options = (term ? myRecipes.filter((r) => r.title.toLowerCase().includes(term)) : myRecipes)
    .filter((r) => !proposedIds.has(r.id))
    .slice(0, 8)

  return (
    <section className="rb-proposals">
      <div className="rb-list-head">
        <h2>Proposals for this week</h2>
        <button
          type="button"
          className="rb-button rb-button--ghost"
          onClick={() => {
            setProposing((v) => !v)
            setSearch('')
          }}
        >
          {proposing ? 'Close' : '+ Propose a recipe'}
        </button>
      </div>

      {proposing && (
        <div className="rb-plan-picker">
          <input
            className="rb-field"
            type="search"
            autoFocus
            placeholder="One of your recipes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {options.length === 0 ? (
            <p className="rb-muted">No matching recipes.</p>
          ) : (
            <ul className="rb-plan-picker__list">
              {options.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="rb-linklike"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await proposeMeal(householdId, r.id, weekStartISO)
                        setProposing(false)
                      })
                    }
                  >
                    {r.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="rb-error">{error}</p>}

      {proposals === null ? (
        <p className="rb-muted">Loading…</p>
      ) : proposals.length === 0 ? (
        <p className="rb-muted">No proposals yet. Propose a recipe for the household to vote on.</p>
      ) : (
        <ul className="rb-friend-list">
          {proposals.map((p) => (
            <li key={p.id} className="rb-proposal">
              <div className="rb-proposal__main">
                <button
                  type="button"
                  className={`rb-proposal__vote${p.votedByMe ? ' is-on' : ''}`}
                  aria-pressed={p.votedByMe}
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      p.votedByMe ? unvoteProposal(p.id, myId) : voteProposal(p.id, myId),
                    )
                  }
                >
                  ▲ {p.voteCount}
                </button>
                <span>
                  {p.recipeTitle ?? '(private recipe)'}{' '}
                  <span className="rb-muted">· by {p.proposedById === myId ? 'you' : p.proposedByName}</span>
                </span>
                <span className="rb-proposal__actions">
                  <button
                    type="button"
                    className="rb-button rb-button--ghost"
                    disabled={busy}
                    onClick={() => setSchedulingId(schedulingId === p.id ? null : p.id)}
                  >
                    Schedule
                  </button>
                  {p.proposedById === myId && (
                    <button
                      type="button"
                      className="rb-icon-button rb-icon-button--sm"
                      aria-label="Withdraw proposal"
                      disabled={busy}
                      onClick={() => run(() => removeProposal(p.id))}
                    >
                      ×
                    </button>
                  )}
                </span>
              </div>

              {schedulingId === p.id && (
                <div className="rb-plan-picker__controls">
                  <select
                    className="rb-field"
                    value={schedDay}
                    onChange={(e) => setSchedDay(e.target.value)}
                    aria-label="Day"
                  >
                    {days.map((d) => (
                      <option key={toISODate(d)} value={toISODate(d)}>
                        {d.toLocaleDateString(undefined, DAY_FMT)}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rb-field"
                    value={schedSlot}
                    onChange={(e) => setSchedSlot(e.target.value as MealSlot)}
                    aria-label="Slot"
                  >
                    {MEAL_SLOTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rb-button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await scheduleProposal(p.id, schedDay, schedSlot)
                        setSchedulingId(null)
                      }, true)
                    }
                  >
                    Add to plan
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
