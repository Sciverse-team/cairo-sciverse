import { SupabaseClient } from '@supabase/supabase-js';

interface ChatAccessData {
  homeTeamId: string | null;
  acceptedTeamIds: string[];
}

export async function getChatAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<ChatAccessData> {
  const [{ data: membership, error: membershipError }, { data: requests, error: requestsError }] =
    await Promise.all([
      supabase
        .from('team_memberships')
        .select('team_id')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('team_chat_requests')
        .select('target_team_id')
        .eq('sender_id', userId)
        .eq('status', 'accepted'),
    ]);

  if (membershipError) throw membershipError;
  if (requestsError) throw requestsError;

  return {
    homeTeamId: membership?.team_id || null,
    acceptedTeamIds: (requests || []).map((request) => request.target_team_id),
  };
}

export function canChatWithTeam(access: ChatAccessData, teamId: string): boolean {
  return access.homeTeamId === teamId || access.acceptedTeamIds.includes(teamId);
}