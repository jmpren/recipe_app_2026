import { useEffect, useState, type FormEvent } from 'react'
import { addRecipeTag, getRecipeTags, listTags, removeRecipeTag, type Tag } from '../lib/tags'

/** Tag chips + an add field on the recipe detail page. Tag changes are metadata,
 *  not a recipe revision (never versioned). `readOnly` = a friend's recipe:
 *  chips only. */
export function TagEditor({ recipeId, readOnly = false }: { recipeId: string; readOnly?: boolean }) {
  const [tags, setTags] = useState<Tag[] | null>(null)
  const [allNames, setAllNames] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getRecipeTags(recipeId)
      .then((t) => {
        if (active) setTags(t)
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Couldn’t load tags')
      })
    return () => {
      active = false
    }
  }, [recipeId])

  useEffect(() => {
    let active = true
    listTags()
      .then((all) => {
        if (active) setAllNames(all.map((t) => t.name))
      })
      .catch(() => {
        /* autocomplete just won't have suggestions */
      })
    return () => {
      active = false
    }
  }, [])

  async function add(e: FormEvent) {
    e.preventDefault()
    const name = input.trim()
    if (!name || busy) return
    setBusy(true)
    setError(null)
    try {
      const tag = await addRecipeTag(recipeId, name)
      setTags((cur) => {
        const list = cur ?? []
        return list.some((t) => t.id === tag.id)
          ? list
          : [...list, tag].sort((a, b) => a.name.localeCompare(b.name))
      })
      setAllNames((cur) => (cur.includes(tag.name) ? cur : [...cur, tag.name].sort()))
      setInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t add tag')
    } finally {
      setBusy(false)
    }
  }

  async function remove(tagId: string) {
    setBusy(true)
    setError(null)
    try {
      await removeRecipeTag(recipeId, tagId)
      setTags((cur) => (cur ?? []).filter((t) => t.id !== tagId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t remove tag')
    } finally {
      setBusy(false)
    }
  }

  if (readOnly) {
    if (!tags || tags.length === 0) return null
    return (
      <div className="rb-tags rb-tags--card">
        {tags.map((t) => (
          <span key={t.id} className="rb-tag">
            {t.name}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="rb-tags-block">
      <div className="rb-tags">
        {(tags ?? []).map((t) => (
          <span key={t.id} className="rb-tag rb-tag--removable">
            {t.name}
            <button
              type="button"
              aria-label={`Remove tag ${t.name}`}
              onClick={() => remove(t.id)}
              disabled={busy}
            >
              ×
            </button>
          </span>
        ))}
        <form className="rb-tag-add" onSubmit={add}>
          <input
            className="rb-field"
            list="rb-all-tags"
            placeholder="Add a tag"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <datalist id="rb-all-tags">
            {allNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <button
            type="submit"
            className="rb-button rb-button--ghost"
            disabled={busy || !input.trim()}
          >
            Add
          </button>
        </form>
      </div>
      {error && <p className="rb-error">{error}</p>}
    </div>
  )
}
