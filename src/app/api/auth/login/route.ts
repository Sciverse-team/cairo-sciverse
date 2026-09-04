import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { identifier, password } = await request.json();
    const supabase = await createClient();

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Please enter your data' }, { status: 400 });
    }

    const cleanName = identifier.trim();

    // 1. البحث عن المستخدم بمطابقة دقيقة لمنع تداخل الحسابات
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, full_name, password_hash')
      .ilike('full_name', cleanName)
      .maybeSingle();

    if (!targetUser) {
      return NextResponse.json({ error: 'Username not found' }, { status: 401 });
    }

    // 2. فحص كلمة المرور
    let isPasswordValid = false;
    if (targetUser.password_hash.startsWith('$2')) {
      isPasswordValid = await bcrypt.compare(password, targetUser.password_hash);
    } else {
      isPasswordValid = password === targetUser.password_hash;
    }

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // 3. جلب بيانات العضوية مع اسم الفريق
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role, team_id, teams ( name )')
      .eq('user_id', targetUser.id)
      .maybeSingle();
      
      let extractedTeamName= 'Cairo SciVerse Team';    // استخراج اسم الفريق مع حماية Type Safety
    if (membership?.teams) {
      if (Array.isArray(membership.teams)&& membership.teams.length > 0) {
        extractedTeamName = membership.teams[0].name;
      } else if (typeof membership.teams === 'object' && 'name' in membership.teams ) {
        extractedTeamName = (membership.teams as { name: string }).name;
      }
    }

    // 4. تعيين الكوكي
    const cookieStore = await cookies();
    cookieStore.set('user_id', targetUser.id, {
      httpOnly: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 أيام
    });

    return NextResponse.json({
      success: true,
      user: {
        userId: targetUser.id,
        fullName: targetUser.full_name,
        role: membership?.role || 'Member',
        teamId: membership?.team_id || null,
        teamName: extractedTeamName ,
      },
    });
  } catch (err) {
    console.error('Login Route Error:', err);
    return NextResponse.json({ error: 'An error occurred on the server' }, { status: 500 });
  }
}