import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // 1. جلب بيانات المستخدم
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, full_name, phone')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 2. جلب بيانات العضوية والفريق
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role, teams ( name )')
      .eq('user_id', userId)
      .maybeSingle();

    let teamName = 'Cairo SciVerse Team';
    const rawTeams = membership?.teams as any;
    if (Array.isArray(rawTeams) && rawTeams.length > 0) {
      teamName = rawTeams[0].name;
    } else if (rawTeams && typeof rawTeams === 'object' && rawTeams.name) {
      teamName = rawTeams.name;
    }

    // 3. جلب الإشعارات (طلبات المحادثة التي أرسلها المستخدم وتغيرت حالتها، أو الطلبات القادمة لليدر)
    const { data: notifications } = await supabase
      .from('team_chat_requests')
      .select(`
        id,
        status,
        teams ( name ),
        sender:users!team_chat_requests_sender_id_fkey ( full_name )
      `)
      .eq('sender_id', userId)
      .in('status', ['accepted', 'rejected']);

    const formattedNotifications = (notifications || []).map((notif: any) => ({
      id: notif.id,
      status: notif.status,
      teamName: notif.teams?.name || 'Team',
      message:
        notif.status === 'accepted'
          ? `You accepted to chat with ${notif.teams?.name}`
          : `You were rejected to chat with ${notif.teams?.name}`,
    }));

    return NextResponse.json({
      success: true,
      profile: {
        fullName: userData.full_name,
        phone: userData.phone || '',
        teamName,
        role: membership?.role || 'Member',
      },
      notifications: formattedNotifications,
    });
  } catch (err) {
    console.error('Fetch Profile Error:', err);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

// PUT: تحديث الهاتف أو كلمة المرور
export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { phone, password } = await request.json();
    const supabase = await createClient();

    const updates: Record<string, any> = {};
    if (phone !== undefined) updates.phone = phone;
    if (password && password.trim() !== '') {
      updates.password_hash = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('users').update(updates).eq('id', userId);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Update Profile Error:', err);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}