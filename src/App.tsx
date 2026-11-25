/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import {
  Flame,
  Music,
  Gamepad2,
  Trophy,
  Compass,
  PlayCircle,
  Clock,
  ThumbsUp,
  History,
  PlaySquare,
  Trash2,
  SearchX,
  Radio,
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { CategoryFilters } from './components/CategoryFilters';
import { VideoCard } from './components/VideoCard';
import { Premium } from './components/Premium';
import { UploadModal } from './components/UploadModal';
import { VideoPage } from './components/VideoPage';
import { ChannelPage } from './components/ChannelPage';
import { AuthModal } from './components/AuthModal';
import { LiveStudio } from './components/LiveStudio';
import { ShortsPlayerModal } from './components/ShortsPlayerModal';
import { SafeImage } from './components/SafeImage';
import { Video } from './lib/data';
import { AuthProvider, useAuth } from './lib/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  setCurrentView: (v: string) => void;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  onCloseMobileSidebar: () => void;
}

function Layout({
  children,
  currentView,
  setCurrentView,
  sidebarCollapsed,
  mobileSidebarOpen,
  onCloseMobileSidebar,
}: LayoutProps) {
  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        isCollapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={onCloseMobileSidebar}
      />
      <main className="flex-1 min-w-0 overflow-x-hidden pb-12">{children}</main>
    </div>
  );
}

interface HomeContentProps {
  videos: Video[];
  loading: boolean;
  currentView: string;
  setCurrentView: (v: string) => void;
  searchQuery: string;
  onClearSearch: () => void;
  onRequireAuth: () => void;
  onOpenShort: (shortId: string) => void;
  onVideosMutated: () => void;
}

function HomeContent({
  videos,
  loading,
  currentView,
  setCurrentView,
  searchQuery,
  onClearSearch,
  onRequireAuth,
  onOpenShort,
  onVideosMutated,
}: HomeContentProps) {
  const { user, authFetch } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [subscriptionsData, setSubscriptionsData] = useState<{
    channels: { channelName: string; avatar: string; subscribers: number }[];
    videos: Video[];
  }>({ channels: [], videos: [] });
  const [watchLaterVideos, setWatchLaterVideos] = useState<Video[]>([]);
  const [historyVideos, setHistoryVideos] = useState<Video[]>([]);
  const [likedVideos, setLikedVideos] = useState<Video[]>([]);
  const [personalLoading, setPersonalLoading] = useState(false);

  const loadPersonalFeeds = useCallback(async () => {
    if (!user) return;
    setPersonalLoading(true);
    try {
      const [subsRes, wlRes, histRes, likedRes] = await Promise.all([
        authFetch('/api/subscriptions'),
        authFetch('/api/watch-later'),
        authFetch('/api/history'),
        authFetch('/api/liked-videos'),
      ]);
      if (subsRes.ok) setSubscriptionsData(await subsRes.json());
      if (wlRes.ok) setWatchLaterVideos(await wlRes.json());
      if (histRes.ok) setHistoryVideos(await histRes.json());
      if (likedRes.ok) setLikedVideos(await likedRes.json());
    } catch {
      // ignore
    } finally {
      setPersonalLoading(false);
    }
  }, [user, authFetch]);

  useEffect(() => {
    if (
      user &&
      ['Subscriptions', 'Library', 'Watch Later', 'Liked Videos'].includes(currentView)
    ) {
      loadPersonalFeeds();
    }
  }, [user, currentView, loadPersonalFeeds]);

  const handleClearHistory = async () => {
    try {
      const res = await authFetch('/api/history', { method: 'DELETE' });
      if (res.ok) setHistoryVideos([]);
    } catch {
      // ignore
    }
  };

  const handleDeleteOwnVideo = async (videoId: string) => {
    try {
      const res = await authFetch(`/api/videos/${encodeURIComponent(videoId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onVideosMutated();
      }
    } catch {
      // ignore
    }
  };

  const regularVideos = videos.filter((v) => !v.isShort);
  const shortVideos = videos.filter((v) => v.isShort);

  // Search Mode overrides home grid cleanly
  const trimmedSearch = searchQuery.trim().toLowerCase();
  if (trimmedSearch && currentView === 'Home') {
    const searchMatches = videos.filter(
      (v) =>
        v.title.toLowerCase().includes(trimmedSearch) ||
        v.channelName.toLowerCase().includes(trimmedSearch) ||
        (v.description || '').toLowerCase().includes(trimmedSearch) ||
        (v.category || '').toLowerCase().includes(trimmedSearch)
    );

    return (
      <div className="p-4 sm:p-6 max-w-[1440px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Search results for “{searchQuery}”
            </h1>
            <p className="text-sm text-slate-500 mt-0.5 tabular-nums">
              {searchMatches.length} result{searchMatches.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClearSearch}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-sm font-medium"
          >
            Clear search
          </button>
        </div>

        {searchMatches.length === 0 ? (
          <div className="py-20 text-center">
            <SearchX className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-900 mb-1">No matching videos</h2>
            <p className="text-sm text-slate-500 mb-5">
              Try searching for a different keyword, creator, or category.
            </p>
            <button
              type="button"
              onClick={onClearSearch}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800"
            >
              Show all videos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
            {searchMatches.map((video) => (
              <Link to={`/video/${video.id}`} key={video.id}>
                <VideoCard video={video} onRequireAuth={onRequireAuth} />
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (currentView === 'Premium') {
    return <Premium onRequireAuth={onRequireAuth} />;
  }

  if (currentView === 'Explore') {
    const liveStreams = regularVideos.filter((v) => v.isLive || v.duration === 'LIVE');
    const featured = liveStreams[0] || regularVideos[0];
    const quickCategories = [
      { label: 'Programming', icon: Compass },
      { label: 'Music', icon: Music },
      { label: 'Gaming', icon: Gamepad2 },
      { label: 'Sports', icon: Trophy },
      { label: 'Live', icon: Radio },
    ];

    return (
      <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Explore Osei TV</h1>
          <p className="text-sm text-slate-600">
            Featured broadcasts, live streams, and curated creator categories.
          </p>
        </div>

        {featured && (
          <Link
            to={`/video/${featured.id}`}
            className="grid grid-cols-1 lg:grid-cols-5 gap-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 group hover:border-slate-300 transition-colors"
          >
            <div className="lg:col-span-3 aspect-video rounded-xl overflow-hidden bg-slate-200 relative">
              <SafeImage
                src={featured.thumbnailUrl}
                alt={featured.title}
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
              />
              <span
                className={`absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                  featured.isLive ? 'bg-red-600 text-white' : 'bg-slate-950/85 text-white'
                }`}
              >
                {featured.isLive ? 'LIVE' : featured.duration}
              </span>
            </div>
            <div className="lg:col-span-2 flex flex-col justify-center">
              <div className="text-xs font-semibold text-red-600 mb-1.5">
                {featured.isLive ? 'Live spotlight' : 'Featured broadcast'}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 group-hover:text-red-700 transition-colors">
                {featured.title}
              </h2>
              <div className="text-sm text-slate-600 mt-2">
                {featured.channelName} · {featured.views}
              </div>
              <p className="text-sm text-slate-600 mt-3 line-clamp-3">{featured.description}</p>
            </div>
          </Link>
        )}

        <div>
          <h2 className="text-base font-bold text-slate-900 mb-3">Browse by category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {quickCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.label);
                    setCurrentView('Home');
                  }}
                  className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-left transition-colors"
                >
                  <span className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-slate-800" />
                  </span>
                  <span className="font-semibold text-sm text-slate-900">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {liveStreams.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Live now</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
              {liveStreams.map((video) => (
                <Link to={`/video/${video.id}`} key={video.id}>
                  <VideoCard video={video} onRequireAuth={onRequireAuth} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (currentView === 'Shorts') {
    return (
      <div className="p-4 sm:p-6 max-w-[1440px] mx-auto">
        <div className="flex items-center gap-2.5 mb-6">
          <PlayCircle className="w-6 h-6 text-red-600" />
          <h1 className="text-2xl font-extrabold text-slate-900">Shorts</h1>
        </div>
        {shortVideos.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            No Shorts published yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {shortVideos.map((short) => (
              <button
                key={short.id}
                type="button"
                onClick={() => onOpenShort(short.id)}
                className="text-left aspect-[9/16] bg-slate-100 rounded-xl relative cursor-pointer overflow-hidden group border border-slate-200"
              >
                <SafeImage
                  src={short.thumbnailUrl}
                  alt={short.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent text-white">
                  <div className="font-semibold text-sm line-clamp-2 leading-snug">
                    {short.title}
                  </div>
                  <div className="text-xs text-white/80 mt-1 tabular-nums">
                    {short.channelName} · {short.views}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (currentView === 'Trending') {
    const trending = [...regularVideos].sort(
      (a, b) => (b.viewCount || 0) - (a.viewCount || 0)
    );
    return (
      <div className="p-4 sm:p-6 max-w-[1200px] mx-auto">
        <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-slate-200">
          <Flame className="w-6 h-6 text-red-600" />
          <h1 className="text-2xl font-extrabold text-slate-900">Trending on Osei TV</h1>
        </div>
        <div className="space-y-4">
          {trending.map((video, idx) => (
            <Link
              key={video.id}
              to={`/video/${video.id}`}
              className="flex flex-col sm:flex-row gap-4 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors group"
            >
              <div className="hidden sm:flex items-center justify-center w-8 text-sm font-mono font-bold text-slate-400 tabular-nums shrink-0">
                {String(idx + 1).padStart(2, '0')}
              </div>
              <div className="w-full sm:w-64 aspect-video rounded-xl overflow-hidden bg-slate-100 relative shrink-0 border border-slate-200">
                <SafeImage
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                />
                <span
                  className={`absolute bottom-1.5 right-1.5 text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${
                    video.isLive ? 'bg-red-600 text-white' : 'bg-slate-950/85 text-white'
                  }`}
                >
                  {video.isLive ? 'LIVE' : video.duration}
                </span>
              </div>
              <div className="flex-1 min-w-0 py-0.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-red-700 transition-colors line-clamp-2">
                  {video.title}
                </h3>
                <div className="text-xs text-slate-500 mt-1 tabular-nums">
                  {video.channelName} · {video.views} · {video.uploadDate}
                </div>
                <p className="text-sm text-slate-600 mt-2 line-clamp-2">{video.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (['Music', 'Gaming', 'Sports'].includes(currentView)) {
    const catLower = currentView.toLowerCase();
    const matched = regularVideos.filter(
      (v) =>
        (v.category || '').toLowerCase() === catLower ||
        v.title.toLowerCase().includes(catLower) ||
        (v.description || '').toLowerCase().includes(catLower)
    );
    const Icon = currentView === 'Music' ? Music : currentView === 'Gaming' ? Gamepad2 : Trophy;

    return (
      <div className="p-4 sm:p-6 max-w-[1440px] mx-auto">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
          <span className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">{currentView}</h1>
            <p className="text-xs text-slate-500 tabular-nums">
              {matched.length} video{matched.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        {matched.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            No {currentView.toLowerCase()} videos available yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
            {matched.map((video) => (
              <Link to={`/video/${video.id}`} key={video.id}>
                <VideoCard video={video} onRequireAuth={onRequireAuth} />
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Personal views requiring sign-in
  if (['Subscriptions', 'Library', 'Watch Later', 'Liked Videos'].includes(currentView)) {
    if (!user) {
      return (
        <div className="max-w-lg mx-auto py-24 px-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto mb-4">
            {currentView === 'Subscriptions' ? (
              <PlaySquare className="w-7 h-7" />
            ) : currentView === 'Watch Later' ? (
              <Clock className="w-7 h-7" />
            ) : currentView === 'Liked Videos' ? (
              <ThumbsUp className="w-7 h-7" />
            ) : (
              <History className="w-7 h-7" />
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Sign in to view {currentView}
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            Keep track of creators you follow, saved videos, watch history, and likes across sessions.
          </p>
          <button
            type="button"
            onClick={onRequireAuth}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800"
          >
            Sign in
          </button>
        </div>
      );
    }

    if (currentView === 'Subscriptions') {
      return (
        <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-6">
          <h1 className="text-2xl font-extrabold text-slate-900">Subscriptions</h1>
          {personalLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-video bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : subscriptionsData.channels.length === 0 ? (
            <div className="py-16 text-center bg-slate-50 border border-slate-200 rounded-2xl px-4">
              <p className="text-sm text-slate-600 mb-4">
                You haven’t subscribed to any channels yet.
              </p>
              <button
                type="button"
                onClick={() => setCurrentView('Home')}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800"
              >
                Discover creators
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {subscriptionsData.channels.map((ch) => (
                  <Link
                    key={ch.channelName}
                    to={`/channel/${encodeURIComponent(ch.channelName)}`}
                    className="flex flex-col items-center gap-2 shrink-0 w-24 group"
                  >
                    <SafeImage
                      src={ch.avatar}
                      alt={ch.channelName}
                      className="w-14 h-14 rounded-full border border-slate-200 group-hover:scale-105 transition-transform"
                    />
                    <span className="text-xs font-medium text-slate-700 truncate w-full text-center">
                      {ch.channelName}
                    </span>
                  </Link>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
                {subscriptionsData.videos.map((video) => (
                  <Link to={`/video/${video.id}`} key={video.id}>
                    <VideoCard video={video} onRequireAuth={onRequireAuth} />
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      );
    }

    if (currentView === 'Watch Later' || currentView === 'Liked Videos') {
      const list = currentView === 'Watch Later' ? watchLaterVideos : likedVideos;
      return (
        <div className="p-4 sm:p-6 max-w-[1440px] mx-auto">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
            <h1 className="text-2xl font-extrabold text-slate-900">{currentView}</h1>
            <span className="text-sm text-slate-500 tabular-nums">
              {list.length} video{list.length === 1 ? '' : 's'}
            </span>
          </div>
          {personalLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-video bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="py-16 text-center bg-slate-50 border border-slate-200 rounded-2xl px-4">
              <p className="text-sm text-slate-600 mb-4">
                {currentView === 'Watch Later'
                  ? 'Save videos to Watch Later and they will appear here.'
                  : 'Videos you like will appear here.'}
              </p>
              <button
                type="button"
                onClick={() => setCurrentView('Home')}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800"
              >
                Browse Home
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
              {list.map((video) => (
                <Link to={`/video/${video.id}`} key={video.id}>
                  <VideoCard video={video} onRequireAuth={onRequireAuth} />
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Library View
    const myUploads = videos.filter((v) => v.userId === user.id);
    return (
      <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-slate-900">Your Library</h1>
          <Link
            to={`/channel/${encodeURIComponent(user.username)}`}
            className="text-sm font-semibold text-red-600 hover:underline"
          >
            View channel
          </Link>
        </div>

        {/* History */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Watch history</h2>
            {historyVideos.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-xs font-medium text-slate-600 hover:text-red-600 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear history
              </button>
            )}
          </div>
          {historyVideos.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500">
              Videos you watch while signed in will appear here.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {historyVideos.slice(0, 4).map((video) => (
                <Link to={`/video/${video.id}`} key={video.id}>
                  <VideoCard video={video} onRequireAuth={onRequireAuth} />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Your Uploads */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Your uploads</h2>
          {myUploads.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500">
              You haven’t uploaded any videos yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {myUploads.map((video) => (
                <Link to={`/video/${video.id}`} key={video.id}>
                  <VideoCard
                    video={video}
                    onRequireAuth={onRequireAuth}
                    showDeleteOption
                    onDeleteVideo={handleDeleteOwnVideo}
                  />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Watch Later Preview */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Watch Later</h2>
            <button
              type="button"
              onClick={() => setCurrentView('Watch Later')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              See all ({watchLaterVideos.length})
            </button>
          </div>
          {watchLaterVideos.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500">
              No saved videos yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {watchLaterVideos.slice(0, 4).map((video) => (
                <Link to={`/video/${video.id}`} key={video.id}>
                  <VideoCard video={video} onRequireAuth={onRequireAuth} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // Default Home Feed
  const filteredVideos =
    selectedCategory === 'All'
      ? regularVideos
      : selectedCategory === 'Live'
      ? regularVideos.filter((v) => v.isLive || v.duration === 'LIVE')
      : selectedCategory === 'Recently uploaded'
      ? regularVideos.slice(0, 8)
      : regularVideos.filter((v) => {
          const catLower = selectedCategory.toLowerCase();
          return (
            (v.category || '').toLowerCase() === catLower ||
            v.title.toLowerCase().includes(catLower) ||
            (v.description || '').toLowerCase().includes(catLower)
          );
        });

  return (
    <>
      <CategoryFilters
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {loading ? (
        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
            <div key={idx} className="space-y-3">
              <div className="aspect-video rounded-xl bg-slate-100 animate-pulse" />
              <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse" />
              <div className="h-3 bg-slate-100 rounded w-1/2 animate-pulse" />
            </div>
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="py-20 px-4 text-center">
          <p className="text-base font-semibold text-slate-800 mb-2">
            No videos found in {selectedCategory}
          </p>
          <p className="text-sm text-slate-500 mb-5">
            Try switching categories or upload a new video to this topic.
          </p>
          <button
            type="button"
            onClick={() => setSelectedCategory('All')}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800"
          >
            Show all videos
          </button>
        </div>
      ) : (
        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
          {filteredVideos.map((video) => (
            <Link to={`/video/${video.id}`} key={video.id}>
              <VideoCard video={video} onRequireAuth={onRequireAuth} />
            </Link>
          ))}
        </div>
      )}

      {/* Shorts Shelf */}
      {shortVideos.length > 0 && (
        <section className="px-4 sm:px-6 py-8 border-t border-slate-200 mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-bold text-slate-900">Shorts</h2>
            </div>
            <button
              type="button"
              onClick={() => setCurrentView('Shorts')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              View all
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {shortVideos.map((short) => (
              <button
                key={short.id}
                type="button"
                onClick={() => onOpenShort(short.id)}
                className="text-left flex-shrink-0 w-40 sm:w-48 aspect-[9/16] bg-slate-100 rounded-xl relative cursor-pointer overflow-hidden group border border-slate-200"
              >
                <SafeImage
                  src={short.thumbnailUrl}
                  alt={short.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent text-white">
                  <div className="font-medium text-sm line-clamp-2 leading-snug">
                    {short.title}
                  </div>
                  <div className="text-xs text-white/80 mt-1 tabular-nums">{short.views}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function MainApp() {
  const [currentView, setCurrentView] = useState('Home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeShortIndex, setActiveShortIndex] = useState<number | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchVideos = useCallback(() => {
    fetch('/api/videos')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setVideos(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const shortVideos = videos.filter((v) => v.isShort);

  const handleOpenShort = (shortId: string) => {
    const idx = shortVideos.findIndex((s) => s.id === shortId);
    if (idx >= 0) setActiveShortIndex(idx);
  };

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setMobileSidebarOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  const handleUploadClick = () => {
    if (!user) {
      setIsAuthModalOpen(true);
    } else {
      setIsUploadModalOpen(true);
    }
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white text-slate-900">
        <Navbar
          onUploadClick={handleUploadClick}
          onLoginClick={() => setIsAuthModalOpen(true)}
          onToggleSidebar={handleToggleSidebar}
          searchQuery={searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q);
            if (q.trim() && currentView !== 'Home') {
              setCurrentView('Home');
            }
          }}
          onSearchSubmit={(q) => {
            setSearchQuery(q);
            setCurrentView('Home');
          }}
        />

        <Routes>
          <Route
            path="/"
            element={
              <Layout
                currentView={currentView}
                setCurrentView={setCurrentView}
                sidebarCollapsed={sidebarCollapsed}
                mobileSidebarOpen={mobileSidebarOpen}
                onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
              >
                <HomeContent
                  videos={videos}
                  loading={loading}
                  currentView={currentView}
                  setCurrentView={setCurrentView}
                  searchQuery={searchQuery}
                  onClearSearch={() => setSearchQuery('')}
                  onRequireAuth={() => setIsAuthModalOpen(true)}
                  onOpenShort={handleOpenShort}
                  onVideosMutated={fetchVideos}
                />
              </Layout>
            }
          />
          <Route
            path="/video/:id"
            element={
              <VideoPage
                videos={videos}
                onRequireAuth={() => setIsAuthModalOpen(true)}
                onVideosMutated={fetchVideos}
              />
            }
          />
          <Route
            path="/channel/:channelName"
            element={
              <Layout
                currentView={currentView}
                setCurrentView={setCurrentView}
                sidebarCollapsed={sidebarCollapsed}
                mobileSidebarOpen={mobileSidebarOpen}
                onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
              >
                <ChannelPage
                  videos={videos}
                  onRequireAuth={() => setIsAuthModalOpen(true)}
                  onUploadClick={handleUploadClick}
                  onVideosMutated={fetchVideos}
                />
              </Layout>
            }
          />
          <Route
            path="/live-studio"
            element={
              <Layout
                currentView="Live Studio"
                setCurrentView={setCurrentView}
                sidebarCollapsed={sidebarCollapsed}
                mobileSidebarOpen={mobileSidebarOpen}
                onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
              >
                <LiveStudio
                  onRequireAuth={() => setIsAuthModalOpen(true)}
                  onVideosMutated={fetchVideos}
                />
              </Layout>
            }
          />
        </Routes>

        <UploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUploaded={() => fetchVideos()}
        />

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />

        <ShortsPlayerModal
          shorts={shortVideos}
          activeIndex={activeShortIndex}
          onClose={() => setActiveShortIndex(null)}
          onChangeIndex={setActiveShortIndex}
          onRequireAuth={() => setIsAuthModalOpen(true)}
        />
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
