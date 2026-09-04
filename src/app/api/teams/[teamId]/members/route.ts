import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { canChatWithTeam, getChatAccess } from '@/lib/chat-access';

interface RelatedUser {
  id: string;
  full_name: string | null;
  email: string | null;
}

// GET: جلب أعضاء الفريق
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    const userId = (await cookies()).get('user_id')?.value;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();
    const access = await getChatAccess(supabase, userId);
    if (!canChatWithTeam(access, teamId)) {
      return NextResponse.json({ error: 'You do not have chat access to this team' }, { status: 403 });
    }

    const { data: members, error } = await supabase
      .from('team_memberships')
      .select(`
        user_id,
        role,
        users (
          id,
          full_name,
          email
        )
      `)
      .eq('team_id', teamId);

    if (error) throw error;

    const formattedMembers = (members || []).map((member) => {
      const relatedUsers = member.users as unknown as RelatedUser | RelatedUser[] | null;
      const user = Array.isArray(relatedUsers) ? relatedUsers[0] : relatedUsers;

      return {
        id: user?.id || member.user_id,
        fullName: user?.full_name || 'Unknown',
        email: user?.email || null,
        role: member.role,
      };
    });

    return NextResponse.json({ success: true, members: formattedMembers });
  } catch (err) {
    console.error('Fetch Members Error:', err);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}