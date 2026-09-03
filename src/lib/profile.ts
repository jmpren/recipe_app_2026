import { supabase } from './supabase'

export interface Profile {
  id: string
  display_name: string
}

/** The signed-in user's profile row (RLS scopes `profiles` to `auth.uid()`). */
export async function getMyProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('id, display_name').maybeSingle()
  if (error) throw error
  return data
}

/** A plain column write — display name is just a label, not versioned data. */
export async function updateMyDisplayName(name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Please enter a name.')

  const { data: auth } = await supabase.auth.getUser()
  const id = auth.user?.id
  if (!id) throw new Error('Not signed in.')

  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Profile not found.')
}

/** True when the display name is still the auto-assigned email (never personalised). */
export function displayNameIsPlaceholder(profile: Profile | null, email: string | null | undefined): boolean {
  if (!profile || !email) return false
  return profile.display_name.trim().toLowerCase() === email.trim().toLowerCase()
}
