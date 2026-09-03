import { useState } from 'react'

interface Props {
  note: string | null
  /** Receives the trimmed note ('' means clear). Should persist and update state. */
  onSave: (note: string) => Promise<void>
}

/**
 * The inline note on a recipe step (PLAN.md §7, NYT-style): shows the note if
 * there is one, plus an add / edit affordance. A note is a private annotation —
 * saving it never touches recipe versions (see lib/recipes.setStepNote).
 */
export function StepNoteEditor({ note, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await onSave(draft.trim())
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save note')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="rb-step-note-edit">
        <textarea
          className="rb-field"
          rows={2}
          value={draft}
          autoFocus
          placeholder="Note for this step (just for you)"
          onChange={(e) => setDraft(e.target.value)}
        />
        {error && <p className="rb-error">{error}</p>}
        <div className="rb-form-actions">
          <button type="button" className="rb-button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save note'}
          </button>
          <button
            type="button"
            className="rb-button rb-button--ghost"
            onClick={() => {
              setDraft(note ?? '')
              setError(null)
              setEditing(false)
            }}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {note && <p className="rb-step-note">{note}</p>}
      <button
        type="button"
        className="rb-step-note-add"
        onClick={() => {
          setDraft(note ?? '')
          setError(null)
          setEditing(true)
        }}
      >
        {note ? 'Edit note' : '+ Add note'}
      </button>
    </>
  )
}
