import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

type MembershipRole = 'Leader' | 'Member' | 'Admin';

interface MembershipRow {
  team_id: string;
  role: MembershipRole;
  teams: { name: string } | { name: string }[] | null;
}

export async function GET() {
  try {
    const userId = (await cookies()).get('user_id')?.value;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .single();

    if (userError || !user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { data: memberships, error: membershipsError } = await supabase
      .from('team_memberships')
      .select('team_id, role, teams(name)')
      .eq('user_id', userId)
      .order('team_id');

    if (membershipsError) throw membershipsError;

    const teams = ((memberships || []) as unknown as MembershipRow[]).map((membership) => {
      const team = Array.isArray(membership.teams) ? membership.teams[0] : membership.teams;
      return {
        id: membership.team_id,
        name: team?.name || 'Unnamed team',
        memberName: user.full_name,
        role: membership.role,
      };
    });

    return NextResponse.json({ success: true, teams });
  } catch (error) {
    console.error('Fetch My Teams Error:', error);
    return NextResponse.json({ error: 'Failed to fetch your teams' }, { status: 500 });
  }
}