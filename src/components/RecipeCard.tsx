import { Link } from 'react-router-dom'
import type { Tag } from '../lib/tags'
import type { Recipe } from '../types'

function totalMinutes(r: Recipe): number | null {
  const sum = (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0)
  return sum > 0 ? sum : null
}

function cardMeta(r: Recipe): string {
  const mins = totalMinutes(r)
  return [r.servings ? `${r.servings} servings` : null, mins ? `${mins} min` : null]
    .filter(Boolean)
    .join(' · ')
}

/** Where a recipe tile was opened from, so the detail page's back arrow can
 *  return there (see RecipeDetail). */
export interface RecipeCardOrigin {
  to: string
  label: string
}

/** One recipe tile in a `.rb-grid`. `from` sets the detail page's back target. */
export function RecipeCard({
  recipe,
  tags,
  from,
}: {
  recipe: Recipe
  tags?: Tag[]
  from?: RecipeCardOrigin
}) {
  const meta = cardMeta(recipe)
  return (
    <Link
      to={`/recipes/${recipe.id}`}
      state={from ? { backTo: from.to, backLabel: from.label } : undefined}
      className="rb-recipe-card"
    >
      <div className="rb-recipe-card__media">
        {recipe.image_url ? (
          <img src={recipe.image_url} alt="" loading="lazy" />
        ) : (
          <span className="rb-recipe-card__placeholder" aria-hidden="true">
            🍲
          </span>
        )}
      </div>
      <div className="rb-recipe-card__body">
        <h2>{recipe.title}</h2>
        {recipe.description && <p className="rb-clamp-2 rb-muted">{recipe.description}</p>}
        {meta && <p className="rb-recipe-card__meta rb-muted">{meta}</p>}
        {tags && tags.length > 0 && (
          <div className="rb-tags rb-tags--card">
            {tags.map((t) => (
              <span key={t.id} className="rb-tag">
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
