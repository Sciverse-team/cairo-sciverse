import { SupabaseClient } from '@supabase/supabase-js';

interface ChatAccessData {
  homeTeamId: string | null;
  teamIds: string[];
  teamRoles: Record<string, string>;
  acceptedTeamIds: string[];
}

export async function getChatAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<ChatAccessData> {
  const [{ data: memberships, error: membershipError }, { data: requests, error: requestsError }] =
    await Promise.all([
      supabase
        .from('team_memberships')
        .select('team_id, role')
        .eq('user_id', userId),
      supabase
        .from('team_chat_requests')
        .select('target_team_id')
        .eq('sender_id', userId)
        .eq('status', 'accepted'),
    ]);

  if (membershipError) throw membershipError;
  if (requestsError) throw requestsError;

  const teamIds = (memberships || []).map((membership) => membership.team_id);
  const teamRoles = Object.fromEntries(
    (memberships || []).map((membership) => [membership.team_id, membership.role])
  );

  return {
    homeTeamId: teamIds[0] || null,
    teamIds,
    teamRoles,
    acceptedTeamIds: (requests || []).map((request) => request.target_team_id),
  };
}

export function canChatWithTeam(access: ChatAccessData, teamId: string): boolean {
  return access.teamIds.includes(teamId) || access.acceptedTeamIds.includes(teamId);
}