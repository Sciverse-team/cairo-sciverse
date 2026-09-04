import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('query')?.trim() || '';

    const supabase = await createClient();

    // 1. معرفة فريق المستخدم الحالي لاستبعاده
    const { data: userMembership } = await supabase
      .from('team_memberships')
      .select('team_id')
      .eq('user_id', userId)
      .maybeSingle();

    const myTeamId = userMembership?.team_id;

    // 2. الاستعلام عن الفرق الأخرى مع دعم البحث
    let teamsQuery = supabase
      .from('teams')
      .select(`
        id,
        name,
        team_memberships (
          user_id,
          role,
          users ( full_name )
        )
      `);

    if (myTeamId) {
      teamsQuery = teamsQuery.neq('id', myTeamId);
    }

    if (searchQuery) {
      teamsQuery = teamsQuery.ilike('name', `%${searchQuery}%`);
    }

    const { data: teamsData, error: teamsError } = await teamsQuery;

    if (teamsError) throw teamsError;

    // 3. جلب طلبات المحادثة الخاصة بذا المستخدم لمعرفة حالة كل فريق (Pending/Accepted/None)
    const { data: myRequests } = await supabase
      .from('team_chat_requests')
      .select('target_team_id, status')
      .eq('sender_id', userId);

    const requestStatusMap = new Map<string, string>();
    myRequests?.forEach((req) => {
      requestStatusMap.set(req.target_team_id, req.status);
    });

    // 4. تنسيق البيانات للـ Frontend
    const formattedTeams = (teamsData || []).map((team) => {
      const memberships = team.team_memberships || [];
      const leaderMembership = memberships.find((m) => m.role === 'Leader');
      
      // استخراج اسم الليدر بأمان
      const leaderUser = leaderMembership?.users as unknown as { full_name: string } | null;
      const leaderName = leaderUser?.full_name || 'No Leader Assigned';

      return {
        id: team.id,
        name: team.name,
        membersCount: memberships.length,
        leaderName,
        requestStatus: requestStatusMap.get(team.id) || 'none', // 'pending' | 'accepted' | 'rejected' | 'none'
      };
    });

    return NextResponse.json({ success: true, teams: formattedTeams });
  } catch (err) {
    console.error('Fetch Other Teams Error:', err);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}

// POST: إرسال طلب محادثة لـ Team
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { targetTeamId } = await request.json();

    if (!targetTeamId) {
      return NextResponse.json({ error: 'Target team ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // التحقق من عدم وجود طلب سابق
    const { data: existingRequest } = await supabase
      .from('team_chat_requests')
      .select('id')
      .eq('sender_id', userId)
      .eq('target_team_id', targetTeamId)
      .maybeSingle();

    if (existingRequest) {
      return NextResponse.json({ error: 'Request already sent' }, { status: 400 });
    }

    // إنشاء طلب جديد
    const { error: insertError } = await supabase
      .from('team_chat_requests')
      .insert({
        sender_id: userId,
        target_team_id: targetTeamId,
        status: 'pending',
      });

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, message: 'Chat request sent successfully' });
  } catch (err) {
    console.error('Send Chat Request Error:', err);
    return NextResponse.json({ error: 'Failed to send request' }, { status: 500 });
  }
}