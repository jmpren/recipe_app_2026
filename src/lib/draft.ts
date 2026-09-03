import type { IngredientDraft, RecipeDraft, StepDraft } from '../types'

export const emptyIngredient = (): IngredientDraft => ({
  quantity: '',
  unit: '',
  name: '',
  notes: '',
})

export const emptyStep = (): StepDraft => ({ instruction: '' })

export const emptyDraft = (): RecipeDraft => ({
  title: '',
  description: '',
  source_url: '',
  source_name: '',
  servings: '',
  prep_minutes: '',
  cook_minutes: '',
  ingredients: [emptyIngredient()],
  steps: [emptyStep()],
})
