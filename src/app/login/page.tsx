'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserPayload {
  userId: string;
  role: string;
  fullName: string;
  teamId?: string | null;
  teamName?: string;
}

interface LoginApiResponse {
  error?: string;
  user?: UserPayload;
}

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      });

      const result: LoginApiResponse = await response.json();

      if (!response.ok || !result.user) {
        throw new Error(result.error || 'The name or password is incorrect');
      }

      // حفظ بيانات المستخدم في LocalStorage للـ Client State
      localStorage.setItem('user', JSON.stringify(result.user));
      localStorage.setItem('user_id', result.user.userId);

      // التوجيه إلى صفحة الفريق
      router.push('/my-team');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-gray-200/60 p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-inner">
            <svg className="h-10 w-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
        </div>

        <h2 className="mb-6 text-center text-xl font-semibold text-gray-800">Log In</h2>

        {error && (
          <div className="mb-4 rounded-md bg-red-100 p-2.5 text-center text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-900">Full Name</label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-md border-none bg-white p-2.5 text-sm text-stone-900 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-900">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border-none bg-white p-2.5 text-sm text-stone-900 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="******"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-500 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}