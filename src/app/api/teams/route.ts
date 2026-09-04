import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getChatAccess } from '@/lib/chat-access';

export async function GET() {
  try {
    const userId = (await cookies()).get('user_id')?.value;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();
    const access = await getChatAccess(supabase, userId);
    const teamIds = [access.homeTeamId, ...access.acceptedTeamIds].filter(
      (teamId): teamId is string => Boolean(teamId)
    );

    if (teamIds.length === 0) return NextResponse.json({ success: true, teams: [] });

    const { data: teams, error } = await supabase
      .from('teams')
      .select(`
        id,
        name,
        team_memberships ( role ),
        messages ( content, created_at )
      `)
      .in('id', teamIds);

    if (error) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedTeams = (teams || []).map((team) => {
      const lastMessage = [...(team.messages || [])].sort(
        (first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime()
      )[0];
      const membership = team.team_memberships?.find((item) => item.role === 'Leader');

      return {
        id: team.id,
        name: team.name,
        role: team.id === access.homeTeamId ? membership?.role || 'Member' : 'Member',
        lastMessage: lastMessage?.content || 'No messages yet',
        lastMessageTime: lastMessage?.created_at || null,
      };
    });

    return NextResponse.json({ success: true, teams: formattedTeams });
  } catch (err) {
    console.error('API Teams Route Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}