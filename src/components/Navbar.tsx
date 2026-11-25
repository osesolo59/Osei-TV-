import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Search,
  Mic,
  Video,
  Bell,
  User,
  LogOut,
  Radio,
  X,
  CheckCheck,
  Tv,
  Sparkles,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { NotificationItem } from '../lib/data';
import { SafeImage } from './SafeImage';
import { formatRelativeDate } from '../lib/avatar';

interface NavbarProps {
  onUploadClick?: () => void;
  onLoginClick?: () => void;
  onToggleSidebar?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onSearchSubmit?: (q: string) => void;
}

export function Navbar({
  onUploadClick,
  onLoginClick,
  onToggleSidebar,
  searchQuery = '',
  onSearchChange,
  onSearchSubmit,
}: NavbarProps) {
  const { user, logout, authFetch } = useAuth();
  const navigate = useNavigate();

  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    authFetch('/api/notifications')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setNotifications(data);
      })
      .catch(() => {});
  }, [user, authFetch]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange?.(localQuery);
    onSearchSubmit?.(localQuery);
    if (window.location.pathname !== '/') {
      navigate('/');
    }
  };

  const handleClearSearch = () => {
    setLocalQuery('');
    onSearchChange?.('');
    onSearchSubmit?.('');
  };

  const handleVoiceSearch = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceMessage('Voice search is not supported in this browser.');
      setTimeout(() => setVoiceMessage(''), 2500);
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        setLocalQuery(transcript);
        onSearchChange?.(transcript);
        onSearchSubmit?.(transcript);
        if (window.location.pathname !== '/') navigate('/');
      };
      recognition.onerror = () => {
        setVoiceMessage('Could not hear speech. Try typing your search.');
        setTimeout(() => setVoiceMessage(''), 2500);
      };
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await authFetch('/api/notifications/read-all', { method: 'POST' });
    } catch {
      // ignore
    }
  };

  return (
    <header className="sticky top-0 z-50 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-4 flex items-center justify-between gap-4 sm:gap-8">
      {/* Zone 1: Menu toggle + Single-element Brand Wordmark */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation sidebar"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-red-600"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link
          to="/"
          onClick={() => {
            setLocalQuery('');
            onSearchChange?.('');
          }}
          className="flex items-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-red-600 rounded-md"
        >
          <span className="w-8 h-6 bg-red-600 text-white rounded-md flex items-center justify-center">
            <Tv className="w-4 h-4" />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-slate-900">
            Osei TV
          </span>
        </Link>
      </div>

      {/* Zone 2: Search Bar */}
      <div className="flex-1 max-w-xl flex items-center gap-2 relative">
        <form onSubmit={handleFormSubmit} className="flex w-full items-center">
          <div className="flex w-full items-center border border-slate-300 bg-slate-50/60 focus-within:bg-white focus-within:border-slate-900 rounded-l-full px-3.5 h-10 transition-colors">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              value={localQuery}
              onChange={(e) => {
                setLocalQuery(e.target.value);
                onSearchChange?.(e.target.value);
              }}
              placeholder="Search videos, channels, or topics"
              aria-label="Search videos"
              className="w-full text-sm text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
            />
            {localQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="p-1 text-slate-400 hover:text-slate-700 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            aria-label="Submit search"
            className="h-10 px-4 bg-slate-100 border border-l-0 border-slate-300 rounded-r-full hover:bg-slate-200 text-slate-700 transition-colors shrink-0"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>

        <button
          type="button"
          onClick={handleVoiceSearch}
          aria-label="Search with voice"
          title={isListening ? 'Listening...' : 'Voice search'}
          className={`w-10 h-10 rounded-full hidden md:flex items-center justify-center shrink-0 transition-colors ${
            isListening
              ? 'bg-red-600 text-white'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <Mic className="w-4 h-4" />
        </button>

        {voiceMessage && (
          <div className="absolute top-12 left-0 right-0 bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg z-50">
            {voiceMessage}
          </div>
        )}
      </div>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {user ? (
          <>
            <Link
              to="/live-studio"
              className="h-10 px-3 rounded-lg hidden sm:flex items-center gap-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Radio className="w-4 h-4" />
              <span className="hidden md:inline">Go Live</span>
            </Link>

            <button
              type="button"
              onClick={onUploadClick}
              className="h-10 px-3 rounded-lg flex items-center gap-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              <Video className="w-4 h-4" />
              <span className="hidden md:inline">Upload</span>
            </button>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="Notifications"
                className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <Link
                          key={n.id}
                          to={n.link}
                          onClick={() => setNotifOpen(false)}
                          className={`block px-4 py-3 hover:bg-slate-50 transition-colors ${
                            !n.isRead ? 'bg-red-50/40' : ''
                          }`}
                        >
                          <div className="text-sm font-medium text-slate-900">{n.title}</div>
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                          <span className="text-[11px] text-slate-400 mt-1 block">
                            {formatRelativeDate(n.createdAt)}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Menu */}
            <div className="relative pl-1" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-label="Account menu"
                className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition-colors"
              >
                <SafeImage
                  src={user.avatar}
                  alt={user.username}
                  className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
                    <SafeImage
                      src={user.avatar}
                      alt={user.username}
                      className="w-10 h-10 rounded-full border border-slate-200"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-900 truncate">
                        {user.username}
                      </div>
                      <div className="text-xs text-slate-500">
                        {user.isPremium ? 'Premium member' : 'Creator account'}
                      </div>
                    </div>
                  </div>
                  <div className="py-1.5">
                    <Link
                      to={`/channel/${encodeURIComponent(user.username)}`}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <User className="w-4 h-4 text-slate-500" />
                      Your channel
                    </Link>
                    <Link
                      to="/live-studio"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Radio className="w-4 h-4 text-red-600" />
                      Live studio
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onUploadClick?.();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left"
                    >
                      <Video className="w-4 h-4 text-slate-500" />
                      Upload video
                    </button>
                    {user.isPremium && (
                      <div className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-amber-700 bg-amber-50/70">
                        <Sparkles className="w-4 h-4" />
                        Osei TV Premium active
                      </div>
                    )}
                  </div>
                  <div className="border-t border-slate-200 py-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={onLoginClick}
            className="h-10 px-4 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <User className="w-4 h-4" />
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
