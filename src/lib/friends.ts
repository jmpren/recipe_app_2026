import { supabase } from './supabase'

export interface FriendPerson {
  id: string
  displayName: string
}

export interface Friendship {
  id: string
  status: 'pending' | 'accepted'
  createdAt: string
  /** The other person (never me). */
  person: FriendPerson
  /** true when I received this request — i.e. I'm the one who can accept it. */
  incoming: boolean
}

interface Row {
  id: string
  status: 'pending' | 'accepted'
  created_at: string
  requester_id: string
  addressee_id: string
  requester: { display_name: string } | null
  addressee: { display_name: string } | null
}

const SELECT =
  'id, status, created_at, requester_id, addressee_id, ' +
  'requester:profiles!friendships_requester_id_fkey(display_name), ' +
  'addressee:profiles!friendships_addressee_id_fkey(display_name)'

export interface FriendState {
  friends: Friendship[]
  incoming: Friendship[]
  outgoing: Friendship[]
}

export async function getFriendState(myId: string): Promise<FriendState> {
  const { data, error } = await supabase
    .from('friendships')
    .select(SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error

  const state: FriendState = { friends: [], incoming: [], outgoing: [] }
  for (const r of (data ?? []) as unknown as Row[]) {
    const iAmRequester = r.requester_id === myId
    const person: FriendPerson = {
      id: iAmRequester ? r.addressee_id : r.requester_id,
      displayName: (iAmRequester ? r.addressee : r.requester)?.display_name ?? 'Someone',
    }
    const f: Friendship = {
      id: r.id,
      status: r.status,
      createdAt: r.created_at,
      person,
      incoming: !iAmRequester,
    }
    if (r.status === 'accepted') state.friends.push(f)
    else if (iAmRequester) state.outgoing.push(f)
    else state.incoming.push(f)
  }
  return state
}

export async function sendFriendRequest(email: string): Promise<void> {
  const { error } = await supabase.rpc('send_friend_request', { addressee_email: email.trim() })
  if (error) throw error
}

/** Accept an incoming request (RPC — addressee only, pending → accepted). */
export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_friend_request', { request_id: friendshipId })
  if (error) throw error
}

/** Decline / cancel / unfriend — a plain delete (RLS: either party). */
export async function removeFriendship(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
  if (error) throw error
}

/** A single person's display name (visible if you share a friendship row). */
export async function getPersonName(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.display_name ?? null
}
