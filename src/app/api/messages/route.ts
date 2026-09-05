import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { canChatWithTeam, getChatAccess } from '@/lib/chat-access';

interface MessageRow {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  users: { full_name: string }[] | null;
}

async function getUserId() {
  const cookieStore = await cookies();
  return cookieStore.get('user_id')?.value || null;
}

export async function GET(request: Request) {
  try {
    const userId = await getUserId();
    const teamId = new URL(request.url).searchParams.get('teamId');

    if (!userId || !teamId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const access = await getChatAccess(supabase, userId);

    if (!canChatWithTeam(access, teamId)) {
      return NextResponse.json({ error: 'You do not have chat access to this team' }, { status: 403 });
    }

    const adminSupabase = createAdminClient();
    const { data: messages, error } = await adminSupabase
      .from('messages')
      .select('id, content, sender_id, created_at, users!messages_sender_id_fkey(full_name)')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const formattedMessages = (messages as MessageRow[] | null || []).map((message) => ({
      id: message.id,
      content: message.content,
      senderId: message.sender_id,
      senderName: message.users?.[0]?.full_name || 'Member',
      createdAt: message.created_at,
    }));

    return NextResponse.json({ success: true, messages: formattedMessages });
  } catch (err) {
    console.error('Fetch messages error:', err);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const teamId = typeof body.teamId === 'string' ? body.teamId : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!teamId || !content) {
      return NextResponse.json({ error: 'Team ID and message content are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const access = await getChatAccess(supabase, userId);
    if (!canChatWithTeam(access, teamId)) {
      return NextResponse.json({ error: 'You do not have chat access to this team' }, { status: 403 });
    }

    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
      .from('messages')
      .insert({ team_id: teamId, sender_id: userId, content });

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Send message error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage.includes('chat access') ? 403 : 500 }
    );
  }
}