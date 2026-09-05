import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

interface ProfileMembership {
  team_id: string;
  role: string;
  teams: { name: string } | { name: string }[] | null;
}

interface ProfileNotification {
  id: string;
  status: 'accepted' | 'rejected';
  teams: { name: string } | { name: string }[] | null;
}

interface ProfileUpdates {
  phone?: string;
  password_hash?: string;
}

function getRelatedName(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value[0] as { name?: string } | undefined;
    return first?.name;
  }
  return (value as { name?: string } | null)?.name;
}

export async function GET() {
  try {
    const userId = (await cookies()).get('user_id')?.value;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, full_name, phone')
      .eq('id', userId)
      .single();

    if (userError || !userData) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { data: memberships, error: membershipsError } = await supabase
      .from('team_memberships')
      .select('team_id, role, teams(name)')
      .eq('user_id', userId);

    if (membershipsError) throw membershipsError;

    const formattedMemberships = ((memberships || []) as unknown as ProfileMembership[]).map((membership) => ({
      id: membership.team_id,
      name: getRelatedName(membership.teams) || 'Team',
      role: membership.role,
    }));
    const primaryMembership = formattedMemberships[0];

    const { data: notifications } = await supabase
      .from('team_chat_requests')
      .select('id, status, teams(name)')
      .eq('sender_id', userId)
      .in('status', ['accepted', 'rejected']);

    const formattedNotifications = ((notifications || []) as unknown as ProfileNotification[]).map((notification) => {
      const teamName = getRelatedName(notification.teams) || 'Team';
      return {
        id: notification.id,
        status: notification.status,
        teamName,
        message: notification.status === 'accepted'
          ? `You accepted to chat with ${teamName}`
          : `You were rejected from chatting with ${teamName}`,
      };
    });

    return NextResponse.json({
      success: true,
      profile: {
        fullName: userData.full_name,
        phone: userData.phone || '',
        teamName: primaryMembership?.name || 'Cairo SciVerse Team',
        role: primaryMembership?.role || 'Member',
        memberships: formattedMemberships,
      },
      notifications: formattedNotifications,
    });
  } catch (error) {
    console.error('Fetch Profile Error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = (await cookies()).get('user_id')?.value;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { phone, password } = await request.json() as { phone?: string; password?: string };
    const updates: ProfileUpdates = {};
    if (phone !== undefined) updates.phone = phone;
    if (password && password.trim() !== '') updates.password_hash = await bcrypt.hash(password, 10);

    if (Object.keys(updates).length > 0) {
      const supabase = await createClient();
      const { error } = await supabase.from('users').update(updates).eq('id', userId);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update Profile Error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}