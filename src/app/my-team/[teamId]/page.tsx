'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Role = 'Leader' | 'Member' | 'Admin';

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

interface TeamDetails {
  name: string;
  memberName: string;
  role: Role;
}

function getUserId(): string | null {
  if (typeof document === 'undefined') return null;
  return document.cookie.split('; ').find((item) => item.startsWith('user_id='))?.split('=')[1] || null;
}

function getRelatedName(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value[0] as { name?: string; full_name?: string } | undefined;
    return first?.name || first?.full_name;
  }
  const related = value as { name?: string; full_name?: string } | null;
  return related?.name || related?.full_name;
}

export default function TeamDetailsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskLinks, setTaskLinks] = useState<Record<string, string>>({});
  const [assignLinks, setAssignLinks] = useState<Record<string, string>>({});
  const [memberDegrees, setMemberDegrees] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadTeam() {
      const userId = getUserId();
      if (!userId) {
        router.push('/login');
        return;
      }

      try {
        const { data: membership, error } = await supabase
          .from('team_memberships')
          .select('role, team_id, teams(name), users(full_name)')
          .eq('team_id', teamId)
          .eq('user_id', userId)
          .maybeSingle();

        if (error || !membership) {
          router.push('/my-team');
          return;
        }

        setTeam({
          name: getRelatedName(membership.teams) || 'Team',
          memberName: getRelatedName(membership.users) || 'Member',
          role: membership.role as Role,
        });

        if (membership.role === 'Member' || membership.role === 'Admin') {
          const { data: taskData } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .eq('team_id', teamId)
            .order('task_number', { ascending: true })
            .limit(3);
          setTasks((taskData || []) as TaskItem[]);
        } else {
          const { data: teamMembers } = await supabase
            .from('team_memberships')
            .select('user_id, users(full_name)')
            .eq('team_id', teamId)
            .neq('user_id', userId);
          setMembers((teamMembers || []).map((item) => ({
            id: item.user_id,
            full_name: getRelatedName(item.users) || 'Member',
          })));
        }
      } catch (loadError) {
        console.error('Fetch Team Error:', loadError);
      } finally {
        setLoading(false);
      }
    }

    loadTeam();
  }, [router, supabase, teamId]);

  async function submitTask(taskId: string) {
    const link = taskLinks[taskId];
    if (!link) return;
    const { error } = await supabase.from('tasks').update({ submission_link: link, is_completed: true }).eq('id', taskId);
    if (!error) setTasks((current) => current.map((task) => task.id === taskId ? { ...task, submission_link: link, is_completed: true } : task));
  }

  async function assignTask(memberId: string) {
    const link = assignLinks[memberId];
    if (!link) return;
    await supabase.from('tasks').insert({
      user_id: memberId,
      team_id: teamId,
      description: link,
      degree: memberDegrees[memberId] || 0,
      is_completed: false,
      task_number: 1,
    });
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center text-slate-600">Loading team...</div>;
  if (!team) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-24 font-sans text-slate-800 md:p-10">
      <header className="mx-auto max-w-4xl border-b border-slate-200 pb-6">
        <Link href="/my-team" className="text-sm font-semibold text-blue-600 hover:underline">← My Teams</Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{team.name}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <span>{team.memberName}</span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">{team.role}</span>
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-4xl">
        {team.role === 'Leader' ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-lg font-bold text-slate-900">Team Members & Assign Tasks</h2>
            <div className="space-y-5">
              {members.map((member) => (
                <div key={member.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-semibold text-slate-900">{member.full_name}</h3>
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                    <input type="url" placeholder="Paste task link here..." value={assignLinks[member.id] || ''} onChange={(event) => setAssignLinks((current) => ({ ...current, [member.id]: event.target.value }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs md:col-span-2" />
                    <div className="flex gap-2">
                      <input type="number" placeholder="Degree" value={memberDegrees[member.id] || ''} onChange={(event) => setMemberDegrees((current) => ({ ...current, [member.id]: Number(event.target.value) }))} className="w-1/2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" />
                      <button onClick={() => assignTask(member.id)} className="w-1/2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Assign</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="space-y-5">
            {[1, 2, 3].map((number) => {
              const task = tasks.find((item) => item.task_number === number);
              return (
                <div key={number} className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-3">
                    <h2 className="font-bold text-slate-900">Task {number}</h2>
                    <span className="text-xs font-bold text-slate-600">{task?.is_completed ? 'Completed' : 'Not sent'}</span>
                  </div>
                  <p className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">{task?.description || 'No task assigned yet.'}</p>
                  <div className="flex gap-2">
                    <input type="url" disabled={!task} placeholder="Send my completed task link..." value={task ? taskLinks[task.id] || task.submission_link || '' : ''} onChange={(event) => task && setTaskLinks((current) => ({ ...current, [task.id]: event.target.value }))} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs" />
                    <button disabled={!task} onClick={() => task && submitTask(task.id)} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Submit</button>
                  </div>
                  <div className="text-right text-xs font-bold text-sky-800">My Degree: {task?.degree || 0}/100</div>
                </div>
              );
            })}
          </section>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around border-t border-slate-200 bg-white px-6 py-3">
        <Link href="/my-team" className="text-xs font-bold text-blue-600">My Teams</Link>
        <Link href="/other-teams" className="text-xs font-bold text-slate-500">Other Teams</Link>
        <Link href={`/messages?teamId=${teamId}`} className="text-xs font-bold text-slate-500">Messages</Link>
        <Link href="/profile" className="text-xs font-bold text-slate-500">Profile</Link>
      </nav>
    </div>
  );
}