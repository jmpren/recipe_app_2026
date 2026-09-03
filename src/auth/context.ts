import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthState {
  session: Session | null
  user: User | null
  /** true until the initial session has been resolved */
  loading: boolean
}

export const AuthContext = createContext<AuthState | undefined>(undefined)
