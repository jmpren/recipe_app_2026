import { createContext } from 'react'
import type { Profile } from '../lib/profile'

export interface ProfileState {
  profile: Profile | null
  loading: boolean
  /** Re-fetch after a change (e.g. the user edits their display name). */
  refresh: () => void
}

export const ProfileContext = createContext<ProfileState | undefined>(undefined)
