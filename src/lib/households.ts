import { supabase } from './supabase'

export interface Household {
  id: string
  name: string
  role: 'owner' | 'member'
}

export interface HouseholdMember {
  userId: string
  displayName: string
  role: 'owner' | 'member'
}

export interface Proposal {
  id: string
  recipeId: string
  recipeTitle: string | null
  proposedById: string
  proposedByName: string
  note: string | null
  voteCount: number
  votedByMe: boolean
}

export async function getMyHouseholds(myId: string): Promise<Household[]> {
  const { data, error } = await supabase
    .from('household_members')
    .select('role, household:households(id, name)')
    .eq('user_id', myId)
  if (error) throw error
  return ((data ?? []) as unknown as {
    role: 'owner' | 'member'
    household: { id: string; name: string } | null
  }[])
    .filter((r) => r.household)
    .map((r) => ({ id: r.household!.id, name: r.household!.name, role: r.role }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createHousehold(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_household', { name: name.trim() })
  if (error) throw error
  return (data as { id: string }).id
}

export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const { data, error } = await supabase
    .from('household_members')
    .select('user_id, role, profile:profiles(display_name)')
    .eq('household_id', householdId)
  if (error) throw error
  return ((data ?? []) as unknown as {
    user_id: string
    role: 'owner' | 'member'
    profile: { display_name: string } | null
  }[])
    .map((r) => ({
      userId: r.user_id,
      role: r.role,
      displayName: r.profile?.display_name ?? 'Someone',
    }))
    .sort((a, b) =>
      a.role === b.role ? a.displayName.localeCompare(b.displayName) : a.role === 'owner' ? -1 : 1,
    )
}

export async function addHouseholdMember(householdId: string, memberUserId: string): Promise<void> {
  const { error } = await supabase.rpc('add_household_member', {
    p_household_id: householdId,
    p_member_user_id: memberUserId,
  })
  if (error) throw error
}

export async function leaveHousehold(householdId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function deleteHousehold(householdId: string): Promise<void> {
  const { error } = await supabase.from('households').delete().eq('id', householdId)
  if (error) throw error
}

interface ProposalRow {
  id: string
  recipe_id: string
  proposed_by: string
  note: string | null
  recipe: { title: string } | null
  proposer: { display_name: string } | null
  proposal_votes: { user_id: string }[]
}

export async function getProposals(
  householdId: string,
  weekStartISO: string,
  myId: string,
): Promise<Proposal[]> {
  const { data, error } = await supabase
    .from('meal_proposals')
    .select(
      'id, recipe_id, proposed_by, note, recipe:recipes(title), ' +
        'proposer:profiles!meal_proposals_proposed_by_fkey(display_name), proposal_votes(user_id)',
    )
    .eq('household_id', householdId)
    .eq('week_start', weekStartISO)
  if (error) throw error

  return ((data ?? []) as unknown as ProposalRow[])
    .map((r) => ({
      id: r.id,
      recipeId: r.recipe_id,
      recipeTitle: r.recipe?.title ?? null,
      proposedById: r.proposed_by,
      proposedByName: r.proposer?.display_name ?? 'Someone',
      note: r.note,
      voteCount: r.proposal_votes.length,
      votedByMe: r.proposal_votes.some((v) => v.user_id === myId),
    }))
    .sort((a, b) => b.voteCount - a.voteCount || a.recipeTitle?.localeCompare(b.recipeTitle ?? '') || 0)
}

export async function proposeMeal(
  householdId: string,
  recipeId: string,
  weekStartISO: string,
  note = '',
): Promise<void> {
  const { error } = await supabase.rpc('propose_meal', {
    p_household_id: householdId,
    p_recipe_id: recipeId,
    p_week_start: weekStartISO,
    p_note: note.trim() || undefined,
  })
  if (error) throw error
}

export async function removeProposal(proposalId: string): Promise<void> {
  const { error } = await supabase.from('meal_proposals').delete().eq('id', proposalId)
  if (error) throw error
}

export async function voteProposal(proposalId: string, myId: string): Promise<void> {
  const { error } = await supabase
    .from('proposal_votes')
    .insert({ proposal_id: proposalId, user_id: myId })
  if (error && error.code !== '23505') throw error
}

export async function unvoteProposal(proposalId: string, myId: string): Promise<void> {
  const { error } = await supabase
    .from('proposal_votes')
    .delete()
    .eq('proposal_id', proposalId)
    .eq('user_id', myId)
  if (error) throw error
}

export async function scheduleProposal(
  proposalId: string,
  plannedOnISO: string,
  slot: string,
): Promise<void> {
  const { error } = await supabase.rpc('schedule_proposal', {
    p_proposal_id: proposalId,
    p_planned_on: plannedOnISO,
    p_slot: slot,
  })
  if (error) throw error
}
