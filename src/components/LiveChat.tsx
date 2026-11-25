import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Send } from 'lucide-react';
import { LiveChatMessage } from '../lib/data';
import { SafeImage } from './SafeImage';
import { generateAvatarDataUri } from '../lib/avatar';

interface LiveChatProps {
  videoId: string;
  dark?: boolean;
}

export function LiveChat({ videoId, dark = false }: LiveChatProps) {
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const { user, authFetch } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    if (!videoId) return;
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}/chat`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setMessages(data);
      }
    } catch {
      // ignore transient poll errors
    }
  }, [videoId]);

  useEffect(() => {
    loadMessages();
    const timer = setInterval(loadMessages, 2500);
    return () => clearInterval(timer);
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = await authFetch(`/api/videos/${encodeURIComponent(videoId)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [...prev, msg]);
        setInput('');
      }
    } finally {
      setSending(false);
    }
  };

  const guestAvatar = generateAvatarDataUri(user?.username || 'Guest Viewer');

  return (
    <div
      className={`flex flex-col h-[460px] rounded-xl border overflow-hidden ${
        dark
          ? 'bg-slate-900 border-slate-800 text-slate-100'
          : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      <div
        className={`px-4 py-3 border-b flex items-center justify-between ${
          dark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <span className="font-semibold text-sm">Live chat</span>
        <span className="text-xs font-mono tabular-nums text-slate-500">
          {messages.length} message{messages.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400 text-center px-4">
            Welcome to live chat. Say hello to start the conversation.
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-2.5 items-start text-sm p-1.5 rounded-lg ${
                dark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'
              }`}
            >
              <SafeImage
                src={m.avatar}
                alt={m.user}
                className="w-6 h-6 rounded-full shrink-0 mt-0.5 border border-slate-200/20"
              />
              <div className="leading-snug min-w-0">
                <span
                  className={`font-semibold mr-2 text-xs ${
                    dark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {m.user}
                </span>
                <span className={`break-words ${dark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {m.text}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div
        className={`p-3 border-t ${
          dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
        }`}
      >
        <form onSubmit={handleSend} className="flex gap-2 items-center">
          <SafeImage
            src={user?.avatar || guestAvatar}
            alt={user?.username || 'Guest'}
            className="w-8 h-8 rounded-full shrink-0 border border-slate-200/20"
          />
          <input
            type="text"
            placeholder={user ? `Chat as ${user.username}...` : 'Chat as Guest Viewer...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={200}
            className={`flex-1 rounded-full px-3.5 py-2 text-sm outline-none transition-colors ${
              dark
                ? 'bg-slate-800 text-white placeholder:text-slate-500 focus:ring-1 focus:ring-red-500'
                : 'bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-slate-900'
            }`}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Send chat message"
            className="w-9 h-9 rounded-full flex items-center justify-center text-red-600 disabled:text-slate-400 hover:bg-red-500/10 transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
