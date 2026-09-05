'use client';

import { useState, useEffect, useRef } from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
}

interface TeamMember {
  id: string;
  fullName: string;
  role: string;
}

interface TeamItem {
  id: string;
  name: string;
  role: string;
  lastMessage: string;
  lastMessageTime?: string;
}

const messageHistoryStorageKey = 'cairo-sciverse-message-history';

function MessagesContent() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get('teamId');

  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('Member');
  const [activeTeam, setActiveTeam] = useState<TeamItem | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // 1. جلب بيانات الكوكي وقائمة الفرق
  useEffect(() => {
    async function initData() {
      try {
        const userIdCookie = document.cookie
          .split('; ')
          .find((row) => row.startsWith('user_id='))
          ?.split('=')[1];
        if (userIdCookie) setCurrentUserId(userIdCookie);

        const profileRes = await fetch('/api/profile');
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setCurrentUserName(profileData.profile?.fullName || '');
          setCurrentUserRole(profileData.profile?.role || 'Member');
        }

        const res = await fetch('/api/teams');//
                const data = await res.json();
        if (res.ok && data.teams) {
          setTeams(data.teams);
          const current = data.teams.find((t: TeamItem) => t.id === teamId) || data.teams[0];
          setActiveTeam(current || null);
        }
      } catch (err) {
        console.error('Init error:', err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, [teamId]);

  // 2. جلب المحادثات والأعضاء للفريق النشط
  // 2. جلب المحادثات والأعضاء للفريق النشط
useEffect(() => {
  if (!activeTeam?.id) return;
  const activeTeamId = activeTeam.id;

  async function fetchChatAndMembers() {
    try {
      const storedHistory = sessionStorage.getItem(messageHistoryStorageKey);
      const historyByTeam = storedHistory
        ? (JSON.parse(storedHistory) as Record<string, Message[]>)
        : {};
      setMessages(historyByTeam[activeTeamId] || []);

      // جلب الرسائل
      const msgRes = await fetch(`/api/messages?teamId=${activeTeamId}`);
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        const teamMessages = msgData.messages || [];
        setMessages(teamMessages);
        try {
          const storedHistory = sessionStorage.getItem(messageHistoryStorageKey);
          const historyByTeam = storedHistory
            ? (JSON.parse(storedHistory) as Record<string, Message[]>)
            : {};
          sessionStorage.setItem(
            messageHistoryStorageKey,
            JSON.stringify({ ...historyByTeam, [activeTeamId]: teamMessages })
          );
        } catch {
          // Session storage is best-effort; Supabase remains the source of truth.
        }
      } else {
        console.error('Messages API error status:', msgRes.status);
      }

      // جلب الأعضاء مع حماية الفحص قبل .json()
      const membersRes = await fetch(`/api/teams/${activeTeamId}/members`);
      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.members || []);
      } else {
        // إذا رجعت صفحة HTML سيعرض لك الـ status والـ HTML النصي لتحديد الخطأ
        const errorText = await membersRes.text();
        console.error(`Members API error [${membersRes.status}]:`, errorText);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }

  fetchChatAndMembers();
}, [activeTeam]);
  // 3. Realtime Subscription
  useEffect(() => {
    if (!activeTeam?.id) return;

    const channel = supabase
      .channel(`room:${activeTeam.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `team_id=eq.${activeTeam.id}`,
        },
        async (payload) => {
          const { data: userData } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', payload.new.sender_id)
            .single();

          const newMsgContent = payload.new.content;

          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [
              ...prev,
              {
                id: payload.new.id,
                content: newMsgContent,
                senderId: payload.new.sender_id,
                senderName: userData?.full_name || 'Member',
                createdAt: payload.new.created_at,
              },
            ];
          });

          // تحديث آخر رسالة في قائمة الفرق
          setTeams((prevTeams) =>
            prevTeams.map((t) =>
              t.id === activeTeam.id ? { ...t, lastMessage: newMsgContent } : t
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTeam, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeTeam) return;

    const text = inputText;
    setInputText('');

    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      content: text,
      senderId: currentUserId || '',
      senderName: currentUserName || 'Member',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMsg]);
    setTeams((prev) =>
      prev.map((t) => (t.id === activeTeam.id ? { ...t, lastMessage: text } : t))
    );

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: activeTeam.id, content: text }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const errorMessage = data.error || 'Message was not saved';
        console.error('Message API error:', errorMessage);
        setMessages((prev) => prev.filter((message) => message.id !== tempId));
        window.alert(`لم يتم حفظ الرسالة: ${errorMessage}`);
        return;
      }

      const historyRes = await fetch(`/api/messages?teamId=${activeTeam.id}`, {
        cache: 'no-store',
      });
      if (!historyRes.ok) {
        console.error('Message history refresh failed:', historyRes.status);
        return;
      }

      const historyData = await historyRes.json();
      setMessages(historyData.messages || []);
    } catch (err) {
      console.error('Send Error:', err);
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      const errorMessage = err instanceof Error ? err.message : 'خطأ غير معروف';
      window.alert(`لم يتم حفظ الرسالة: ${errorMessage}`);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading chats...</div>;

  return (
    <div className="flex h-screen bg-gray-100 pb-16">
      {/* Sidebar / Team List (WhatsApp Style) */}
      <div className="w-1/3 border-r border-gray-300 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200 font-bold text-lg text-gray-800">
          Messages
        </div>
        <div className="flex-1 overflow-y-auto">
          {teams.map((team) => (
            <div
              key={team.id}
              onClick={() => setActiveTeam(team)}
              className={`p-3 border-b border-gray-100 cursor-pointer flex items-center justify-between hover:bg-gray-50 ${
                activeTeam?.id === team.id ? 'bg-blue-50 border-r-4 border-r-blue-600' : ''
              }`}
            >
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-gray-900">{team.name}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      team.role === 'Leader'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {team.role}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate mt-1">{team.lastMessage}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat View */}
      <div className="flex-1 flex flex-col bg-gray-200">
        {activeTeam ? (
          <>
            {/* Top Banner (Clickable for Members Modal) */}
            <header
              onClick={() => setShowMembersModal(true)}
              className="flex items-center justify-between bg-white p-3 shadow-sm border-b border-gray-300 cursor-pointer hover:bg-gray-50 transition"
            >
              <div className="flex items-center space-x-3 space-x-reverse">
                <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                  {activeTeam.name.charAt(0)}
                </div>
                <div>
                  <h1 className="text-sm font-bold text-gray-900">{activeTeam.name}</h1>
                  <p className="text-xs text-gray-500">
                    {members.length} members • Click to view group info
                  </p>
                </div>
              </div>
            </header>

            {/* Messages List */}
            <main className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => {
                const isMe = msg.senderId === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm text-sm ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-white text-gray-800 rounded-bl-none'
                      }`}
                    >
                      <span
                        className={`block text-[10px] font-bold mb-1 ${
                          isMe ? 'text-blue-100' : 'text-blue-500'
                        }`}
                      >
                        {msg.senderName}
                        {isMe && ` • ${currentUserRole}`}
                      </span>
                      <p>{msg.content}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </main>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Message ${activeTeam.name}...`}
                className="flex-1 rounded-xl border border-gray-300 p-3 text-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a conversation to start chatting
          </div>
        )}
      </div>

      {/* Members Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-96 p-5 shadow-xl">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-gray-800">{activeTeam?.name} Members</h3>
              <button
                onClick={() => setShowMembersModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {members.map((member) => (
                <div key={member.id} className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-700">{member.fullName}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      member.role === 'Leader'
                        ? 'bg-purple-100 text-purple-700 font-bold'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading chats...</div>}>
      <MessagesContent />
    </Suspense>
  );
}