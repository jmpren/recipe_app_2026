import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getMyProfile, type Profile } from '../lib/profile'
import { ProfileContext, type ProfileState } from './profileContext'
import { useAuth } from './useAuth'

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    setLoading(true)
    setTick((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!userId) return
    let active = true
    getMyProfile()
      .then((p) => {
        if (active) setProfile(p)
      })
      .catch(() => {
        if (active) setProfile(null) // never lock anyone out over a profile read
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [userId, tick])

  const value = useMemo<ProfileState>(
    () => ({
      profile: userId ? profile : null,
      loading: userId ? loading : false,
      refresh,
    }),
    [userId, profile, loading, refresh],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}
