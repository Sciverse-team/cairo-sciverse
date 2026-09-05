'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface NotificationItem {
  id: string;
  status: 'accepted' | 'rejected';
  teamName: string;
  message: string;
}

interface TeamMembership {
  id: string;
  name: string;
  role: string;
}

export default function ProfilePage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [teamName, setTeamName] = useState('');
  const [role, setRole] = useState('');
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/profile');
        const data = await res.json();

        if (res.ok && data.profile) {
          setFullName(data.profile.fullName || '');
          setPhone(data.profile.phone || ''); // تم إصلاح استخراج الهاتف هنا
          setTeamName(data.profile.teamName || '');
          setRole(data.profile.role || '');
            setMemberships(data.profile.memberships || []);
          setNotifications(data.notifications || []);
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });

      const data = await res.json();
      if (res.ok) {
        setMsg({ type: 'success', text: 'Profile updated successfully!' });
        setPassword('');
      } else {
        setMsg({ type: 'error', text: data.error || 'Failed to update' });
      }
    } catch {
      setMsg({ type: 'error', text: 'An error occurred' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading profile...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20 text-gray-800">
      {/* Header & Bell Icon */}
      <header className="relative flex items-center justify-between bg-white p-4 shadow-sm">
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative text-2xl p-1 focus:outline-none"
        >
          🔔
          {notifications.length > 0 && (
            <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white"></span>
          )}
        </button>

        <button
          onClick={() => router.push('/my-team')}
          className="text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          Back
        </button>
      </header>

      {/* Notifications List */}
      {showNotifications && (
        <div className="mx-auto max-w-md px-4 pt-2">
          <div className="space-y-2 rounded-xl bg-white p-3 shadow-md border border-gray-200">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Notifications</h3>
            {notifications.length === 0 ? (
              <p className="text-xs text-gray-400">No new notifications</p>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="flex items-center justify-between rounded-lg p-2 text-xs bg-gray-50"
                >
                  <div
                    className={`p-2 rounded-md font-medium text-white ${
                      notif.status === 'accepted' ? 'bg-amber-400' : 'bg-red-500'
                    }`}
                  >
                    {notif.message}
                  </div>
                  {notif.status === 'accepted' && (
                    <button
                      onClick={() => router.push('/messages')}
                      className="ml-2 rounded-lg bg-orange-200 px-3 py-1 font-bold text-orange-800 hover:bg-orange-300"
                    >
                      go to chat
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Profile Main Form */}
      <main className="mx-auto max-w-md p-4 space-y-4">
        <div className="flex flex-col items-center justify-center py-2">
          <div className="h-16 w-16 rounded-full bg-gray-300 flex items-center justify-center text-2xl text-gray-600">
            👤
          </div>
          <h2 className="mt-2 text-base font-bold text-gray-800">{fullName}</h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500">Name</label>
            <input
              type="text"
              disabled
              value={fullName}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600 shadow-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 01155555555"
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-800 shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500">New Password (Optional)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Type to change password..."
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-800 shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500">Groups</label>
            <div className="mt-1 space-y-2">
              {(memberships.length > 0 ? memberships : [{ id: 'default', name: teamName, role }]).map((membership) => (
                <div key={membership.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3 text-sm shadow-sm">
                  <span className="font-medium text-gray-700">{membership.name}</span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">{membership.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {msg && (
          <p
            className={`text-center text-xs font-medium ${
              msg.type === 'success' ? 'text-emerald-600' : 'text-red-500'
            }`}
          >
            {msg.text}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 w-full rounded-xl bg-sky-400 py-3 text-sm font-bold text-white shadow-md transition hover:bg-sky-500 active:scale-98 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </main>

      {/* Footer Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t border-gray-200 bg-white py-3 text-xs text-gray-500">
        <button onClick={() => router.push('/my-team')} className="hover:text-gray-900">
          Home
        </button>
        <button onClick={() => router.push('/other-teams')} className="hover:text-gray-900">
          Other Teams
        </button>
        <button onClick={() => router.push('/messages')} className="hover:text-gray-900">
          Messages
        </button>
        <button onClick={() => router.push('/profile')} className="font-bold text-blue-600">
          Profile
        </button>
      </nav>
    </div>
  );
}