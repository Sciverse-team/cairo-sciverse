'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface TeamItem {
  id: string;
  name: string;
  membersCount: number;
  leaderName: string;
  requestStatus: 'none' | 'pending' | 'accepted' | 'rejected';
}

export default function OtherTeamsPage() {
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  // دالة جلب الفرق
  const fetchTeams = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/other?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok && data.teams) {
        setTeams(data.teams);
      }
    } catch (err) {
      console.error('Failed to load teams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTeams(searchQuery);
    }, 300); // Debounce للبحث

    return () => clearTimeout(timer);
  }, [searchQuery, fetchTeams]);

  // دالة إرسال طلب المحادثة
  const handleSendRequest = async (teamId: string) => {
    setRequestingId(teamId);
    try {
      const res = await fetch('/api/teams/other', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTeamId: teamId }),
      });

      if (res.ok) {
        setTeams((prev) =>
          prev.map((team) =>
            team.id === teamId ? { ...team, requestStatus: 'pending' } : team
          )
        );
      }
    } catch (err) {
      console.error('Request Error:', err);
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 text-gray-800 pb-20">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white shadow-sm">
        <Link href="/my-team" className="text-sm font-medium text-gray-600 hover:text-gray-900">
          Back
        </Link>
        <h1 className="text-lg font-bold text-gray-800">Other Teams</h1>
        <div className="w-8"></div>
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full">
        {/* Search Bar */}
        <div className="mb-6 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type the team..."
            className="w-full rounded-xl border border-gray-300 bg-white p-3 pr-10 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute right-3 top-3 text-emerald-500 font-bold">✓</span>
        </div>

        {/* Section Header */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-500">
            {searchQuery ? 'Search Results' : 'Suggestions (All other teams)'}
          </h2>
        </div>

        {/* Teams List */}
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading teams...</div>
        ) : teams.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No other teams found.</div>
        ) : (
          <div className="space-y-4">
            {teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between rounded-2xl bg-emerald-100/70 p-4 shadow-sm border border-emerald-200"
              >
                {/* Team Info */}
                <div className="space-y-1">
                  <h3 className="font-bold text-gray-900 text-base">{team.name}</h3>
                  <p className="text-xs text-gray-600">
                    Members: <span className="font-medium">{team.membersCount}</span>
                  </p>
                  <p className="text-xs text-gray-600">
                    Leader: <span className="font-medium">{team.leaderName}</span>
                  </p>
                </div>

                {/* Request Button */}
                <div>
                  {team.requestStatus === 'none' && (
                    <button
                      onClick={() => handleSendRequest(team.id)}
                      disabled={requestingId === team.id}
                      className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {requestingId === team.id ? 'Sending...' : 'Chatting request'}
                    </button>
                  )}

                  {team.requestStatus === 'pending' && (
                    <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-700 border border-amber-300">
                      Pending
                    </span>
                  )}

                  {team.requestStatus === 'accepted' && (
                    <Link
                      href={`/messages?teamId=${team.id}`}
                      className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Go to chat
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t border-gray-200 bg-white py-3 text-xs text-gray-500">
        <Link href="/my-team" className="hover:text-gray-900">
          Home
        </Link>
        <Link href="/other-teams" className="font-bold text-blue-600">
          Other Teams
        </Link>
        <Link href="/messages" className="hover:text-gray-900">
          Messages
        </Link>
        <Link href="/profile" className="hover:text-gray-900">
          Profile
        </Link>
      </nav>
    </div>
  );
}