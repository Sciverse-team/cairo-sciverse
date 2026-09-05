'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Role = 'Leader' | 'Member' | 'Admin';

interface TeamMembership {
  id: string;
  name: string;
  memberName: string;
  role: Role;
}

export default function MyTeamPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadTeams() {
      try {
        const response = await fetch('/api/my-teams');
        const data = await response.json();
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        if (!response.ok) throw new Error(data.error || 'Failed to load teams');
        setTeams(data.teams || []);
      } catch (loadError) {
        console.error('Failed to load teams:', loadError);
        setError('Could not load your teams. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadTeams();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-24 font-sans text-slate-800 md:p-10">
      <header className="mx-auto max-w-4xl border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Teams</h1>
        <p className="mt-2 text-sm text-slate-500">Choose a team to view its tasks and members.</p>
      </header>

      <main className="mx-auto mt-8 max-w-4xl">
        {loading ? (
          <div className="py-12 text-center text-slate-500">Loading your teams...</div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>
        ) : teams.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">You are not assigned to a team yet.</div>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-[1.4fr_1fr_0.8fr] gap-4 border-b border-slate-200 bg-slate-100 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              <span>Team</span><span>Your name</span><span>Role</span>
            </div>
            <div className="divide-y divide-slate-100">
              {teams.map((team) => (
                <Link key={`${team.id}-${team.role}`} href={`/my-team/${team.id}`} className="grid grid-cols-[1.4fr_1fr_0.8fr] items-center gap-4 px-5 py-5 transition hover:bg-blue-50">
                  <span className="font-semibold text-slate-900">{team.name}</span>
                  <span className="text-sm text-slate-600">{team.memberName}</span>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${team.role === 'Leader' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{team.role}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around border-t border-slate-200 bg-white px-6 py-3">
        <Link href="/my-team" className="text-xs font-bold text-blue-600">My Teams</Link>
        <Link href="/other-teams" className="text-xs font-bold text-slate-500">Other Teams</Link>
        <Link href="/messages" className="text-xs font-bold text-slate-500">Messages</Link>
        <Link href="/profile" className="text-xs font-bold text-slate-500">Profile</Link>
      </nav>
    </div>
  );
}