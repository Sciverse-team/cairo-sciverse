'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface TaskItem {
  id: string;
  task_number: number;
  description: string;
  submission_link?: string;
  is_completed: boolean;
  degree?: number;
}

interface TeamMember {
  id: string;
  full_name: string;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export default function MyTeamPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [loading, setLoading] = useState(true);

  const [currentUser, setCurrentUser] = useState<{ name: string; role: 'Leader' | 'Member'; teamName: string } | null>(null);
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  // States للرابط والدرجات
  const [assignLink, setAssignLink] = useState<{ [memberId: string]: string }>({});
  const [memberDegrees, setMemberDegrees] = useState<{ [memberId: string]: number }>({});
  const [taskLinks, setTaskLinks] = useState<{ [taskId: string]: string }>({});

  useEffect(() => {
    async function loadTeamData() {
      try {
        setLoading(true);
        const userId = getCookie('user_id');

        if (!userId) {
          router.push('/login');
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', userId)
          .single();

        const { data: membership } = await supabase
          .from('team_memberships')
          .select('role, team_id, teams(name)')
          .eq('user_id', userId)
          .single();

        if (userData && membership) {
          const activeRole = membership.role as 'Leader' | 'Member';
         let fetchedTeamName = 'Cairo SciVerse Team'; // Default team name
         const rawTeams = membership.teams as any;

         if (Array.isArray(rawTeams) && rawTeams.length > 0) {
           fetchedTeamName = rawTeams[0].name;
         } else if (rawTeams && typeof rawTeams === 'object' && 'rawTeams.name' ) {
           fetchedTeamName = rawTeams.name;
         }

          setTeamName(fetchedTeamName);
          setCurrentUser({
            name: userData.full_name,
            role: activeRole,
            teamName: fetchedTeamName
          });

          if (activeRole === 'Member') {
            const { data: tasksData } = await supabase
              .from('tasks')
              .select('*')
              .eq('user_id', userId)
              .order('task_number', { ascending: true })
              .limit(3);

            if (tasksData) setTasks(tasksData);
          } else {
            const { data: teamMembersData } = await supabase
              .from('team_memberships')
              .select('user_id, users(full_name)')
              .eq('team_id', membership.team_id)
              .neq('user_id', userId);

            if (teamMembersData) {
              setMembers(
                (teamMembersData.map((m:any) => ({
                  id: m.user_id,
                  full_name: m.users?.full_name || 'Member',
                })))
              );
            }
          }
        }
      } catch (err) {
        console.error('Fetch Error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadTeamData();
  }, [supabase, router]);

  // دالة الليدر لإسناد التاسك والدرجة
  const handleAssignTask = async (memberId: string) => {
    const link = assignLink[memberId];
    const degree = memberDegrees[memberId] || 0;

    if (!link) return alert('الرجاء إدخال رابط المهمة أولاً');

    const { error } = await supabase.from('tasks').insert({
      user_id: memberId,
      description: link,
      degree: degree,
      is_completed: false,
      task_number: 1,
    });

    if (error) alert('خطأ في إرسال المهمة: ' + error.message);
    else alert('تم إرسال المهمة والدرجة بنجاح!');
  };

  // دالة العضو لرفع حل المهمة
  const handleMemberSubmit = async (taskId: string) => {
    const link = taskLinks[taskId];
    if (!link) return alert('الرجاء إدخال رابط الحل');

    const { error } = await supabase
      .from('tasks')
      .update({ submission_link: link, is_completed: true })
      .eq('id', taskId);

    if (error) {
      alert('خطأ في التسليم: ' + error.message);
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, submission_link: link, is_completed: true } : t))
      );
      alert('تم إرسال الحل بنجاح!');
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-600 font-sans">Loading My Team Data...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 p-6 md:p-10 font-sans text-slate-800">
      {/* Header */}
      <header className="max-w-4xl mx-auto flex items-center justify-between pb-6 border-b border-slate-200">
        <div>
          <button onClick={() => router.back()} className="text-sm font-semibold text-blue-600 hover:underline mb-2">← Back</button>
          <h1 className="text-2xl font-bold text-slate-900">{teamName || 'Cairo SciVerse Team'}</h1>

          {currentUser && (
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-slate-800">{currentUser.name}</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  currentUser.role === 'Leader' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {currentUser.role}
                </span>
              </div>

              <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <span>Team:</span>
                <span className="font-semibold text-slate-700">{currentUser.teamName}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto mt-8">
        {currentUser?.role === 'Leader' ? (
          /* ================= UI الليدر ================= */
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Team Members & Assign Tasks</h2>
            <div className="space-y-6">
              {members.map((member) => (
                <div key={member.id} className="p-4 border border-slate-200 rounded-xl space-y-3 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{member.full_name}</h3>
                      <span className="text-xs text-slate-500">Member</span>
                    </div>

                    <button 
                      onClick={() => router.push('/messages')}
                      className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 transition"
                    >
                      Chat / Messages
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2">
                    <input
                      type="url"
                      placeholder="Paste task link here..."
                      value={assignLink[member.id] || ''}
                      onChange={(e) => setAssignLink(prev => ({ ...prev, [member.id]: e.target.value }))}
                      className="md:col-span-2 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Degree (e.g. 100)"
                        value={memberDegrees[member.id] || ''}
                        onChange={(e) => setMemberDegrees(prev => ({ ...prev, [member.id]: Number(e.target.value) }))}
                        className="w-1/2 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => handleAssignTask(member.id)}
                        className="w-1/2 px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition"
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          /* ================= UI العضو (Member) ================= */
          <section className="space-y-6">
            {[1, 2, 3].map((num) => {
              const task = tasks.find((t) => t.task_number === num);
              const isSent = task?.is_completed;

              return (
                <div key={num} className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-amber-200/50 pb-3">
                    <h3 className="font-bold text-slate-900 text-base">Task {num}</h3>
                    <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                      isSent ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {isSent ? 'تم ارسال الـ Task ✓' : 'Not sended'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-sm font-medium text-slate-700">
                      What&apos;s my task:{' '}
                      <span className="font-normal text-slate-600">
                        {task?.description || 'لا يوجد وصف متاح من الليدر حالياً'}
                      </span>
                    </span>
                    {task?.description && (
                      <a
                        href={task.description}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold rounded-md transition"
                      >
                        View
                      </a>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="send my completed task link..."
                      disabled={!task}
                      value={(task?.id && taskLinks[task.id]) || task?.submission_link || ''}
                      onChange={(e) => {
                        if (task?.id) {
                          const val = e.target.value;
                          setTaskLinks((prev) => ({ ...prev, [task.id]: val }));
                        }
                      }}
                      className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                    />
                    <button
                      onClick={() => task && handleMemberSubmit(task.id)}
                      disabled={!task}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                    >
                      Send completed task
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => router.push('/messages')}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition"
                    >
                      Chat with my team
                    </button>
                    <div className="bg-sky-100 px-3 py-1.5 rounded-lg text-xs font-bold text-sky-800">
                      My Degree:{' '}
                      <span className="bg-sky-500 text-white px-2 py-0.5 rounded ml-1">
                        {task?.degree || 0}/100
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>

      {/* Task Bar السفلي */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-around items-center z-50">
        <button onClick={() => router.push('/my-team')} className="flex flex-col items-center text-blue-600">
          <span className="text-xs font-bold">My Team</span>
        </button>
        <button 
    onClick={() => router.push('/other-teams')} 
    className="flex flex-col items-center text-slate-500 hover:text-slate-900 font-bold text-xs"
  >
    <span>Other Teams</span>
  </button>
        <button onClick={() => router.push('/messages')} className="flex flex-col items-center text-slate-500 hover:text-slate-900">
          <span className="text-xs font-bold">Messages</span>
        </button>
        <button 
    onClick={() => router.push('/profile')} 
    className="flex flex-col items-center text-slate-500 hover:text-slate-900 font-bold text-xs"
  >
    <span>Profile</span>
  </button>

      </footer>
    </div>
  );
}