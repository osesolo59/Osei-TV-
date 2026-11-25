import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Video as VideoIcon, Radio } from 'lucide-react';
import { VideoCard } from './VideoCard';
import { SafeImage } from './SafeImage';
import { Video, ChannelInfo } from '../lib/data';
import { useAuth } from '../lib/AuthContext';
import { formatCompactNumber } from '../lib/avatar';

interface ChannelPageProps {
  videos: Video[];
  onRequireAuth: () => void;
  onUploadClick: () => void;
  onVideosMutated: () => void;
}

export function ChannelPage({
  videos,
  onRequireAuth,
  onUploadClick,
  onVideosMutated,
}: ChannelPageProps) {
  const { channelName } = useParams<{ channelName: string }>();
  const { user, authFetch } = useAuth();
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [channelVideos, setChannelVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Home' | 'Videos' | 'Shorts' | 'About'>('Videos');

  useEffect(() => {
    if (!channelName) return;
    let active = true;
    setLoading(true);
    authFetch(`/api/channels/${encodeURIComponent(channelName)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.channel) {
          setChannelInfo(data.channel);
          setChannelVideos(data.videos || []);
        } else {
          // Fallback to passed videos
          const matched = videos.filter(
            (v) => v.channelName.toLowerCase() === decodeURIComponent(channelName).toLowerCase()
          );
          if (matched.length > 0) {
            setChannelVideos(matched);
            setChannelInfo({
              channelName: matched[0].channelName,
              handle: `@${matched[0].channelName.replace(/\s+/g, '').toLowerCase()}`,
              avatar: matched[0].channelAvatar,
              subscribers: 12000,
              isSubscribed: false,
              totalViews: matched.reduce((s, v) => s + (v.viewCount || 0), 0),
              videoCount: matched.length,
              joinedDate: 'Mar 2024',
              bio: `Official ${matched[0].channelName} channel on Osei TV.`,
            });
          } else {
            setChannelInfo(null);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [channelName, user?.id, videos.length]);

  const handleToggleSubscribe = async () => {
    if (!channelInfo) return;
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      const res = await authFetch('/api/subscriptions/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName: channelInfo.channelName }),
      });
      if (res.ok) {
        const data = await res.json();
        setChannelInfo((prev) =>
          prev
            ? {
                ...prev,
                isSubscribed: data.isSubscribed,
                subscribers: data.subscribers,
              }
            : prev
        );
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    try {
      const res = await authFetch(`/api/videos/${encodeURIComponent(videoId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setChannelVideos((prev) => prev.filter((v) => v.id !== videoId));
        onVideosMutated();
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="h-44 rounded-2xl bg-slate-100 animate-pulse" />
        <div className="h-16 w-80 bg-slate-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!channelInfo) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Channel not found</h2>
        <p className="text-sm text-slate-500 mb-6">
          This creator channel does not exist yet on Osei TV.
        </p>
        <Link
          to="/"
          className="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
        >
          Browse Home
        </Link>
      </div>
    );
  }

  const isOwner =
    user && user.username.toLowerCase() === channelInfo.channelName.toLowerCase();
  const regularVideos = channelVideos.filter((v) => !v.isShort);
  const shortVideos = channelVideos.filter((v) => v.isShort);

  return (
    <div className="flex-1 bg-white min-h-screen pb-12">
      {/* Editorial Studio Banner */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 pt-4">
        <div className="w-full h-36 sm:h-52 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden flex items-end p-6">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,#dc2626,transparent_55%)]" />
          <div className="relative text-white/90 text-xs font-mono tracking-wide">
            OSEI TV CREATOR CHANNEL
          </div>
        </div>
      </div>

      {/* Channel Header Info */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-slate-200">
          <div className="flex items-center gap-5">
            <SafeImage
              src={channelInfo.avatar}
              alt={channelInfo.channelName}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-slate-200 bg-white shrink-0 object-cover"
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                {channelInfo.channelName}
              </h1>
              <div className="text-sm text-slate-600 mt-1 flex flex-wrap items-center gap-1.5 tabular-nums">
                <span>{channelInfo.handle}</span>
                <span aria-hidden="true">·</span>
                <span>{formatCompactNumber(channelInfo.subscribers)} subscribers</span>
                <span aria-hidden="true">·</span>
                <span>
                  {channelVideos.length} video{channelVideos.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1.5 max-w-2xl line-clamp-2">
                {channelInfo.bio}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isOwner ? (
              <>
                <button
                  type="button"
                  onClick={onUploadClick}
                  className="px-4 py-2.5 bg-slate-900 text-white rounded-full text-sm font-semibold hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap"
                >
                  <VideoIcon className="w-4 h-4" />
                  Upload video
                </button>
                <Link
                  to="/live-studio"
                  className="px-4 py-2.5 border border-slate-300 text-slate-800 rounded-full text-sm font-semibold hover:bg-slate-50 flex items-center gap-2 whitespace-nowrap"
                >
                  <Radio className="w-4 h-4 text-red-600" />
                  Live studio
                </Link>
              </>
            ) : (
              <button
                type="button"
                onClick={handleToggleSubscribe}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${
                  channelInfo.isSubscribed
                    ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {channelInfo.isSubscribed ? 'Subscribed' : 'Subscribe'}
              </button>
            )}
          </div>
        </div>

        {/* Channel Navigation Tabs */}
        <div className="flex gap-6 border-b border-slate-200 mb-6 overflow-x-auto no-scrollbar">
          {(['Home', 'Videos', 'Shorts', 'About'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'About' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl">
            <div className="md:col-span-2 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Description</h2>
              <p className="text-sm text-slate-700 leading-relaxed">{channelInfo.bio}</p>
            </div>
            <div className="space-y-3 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6 text-sm">
              <h2 className="text-lg font-bold text-slate-900">Stats</h2>
              <div className="text-slate-600">Joined {channelInfo.joinedDate}</div>
              <div className="text-slate-600 tabular-nums">
                {channelInfo.totalViews.toLocaleString()} total views
              </div>
              <div className="text-slate-600 tabular-nums">
                {channelInfo.subscribers.toLocaleString()} subscribers
              </div>
            </div>
          </div>
        ) : activeTab === 'Shorts' ? (
          shortVideos.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              No Shorts published on this channel yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {shortVideos.map((v) => (
                <Link
                  to={`/video/${v.id}`}
                  key={v.id}
                  className="aspect-[9/16] rounded-xl overflow-hidden bg-slate-100 relative group border border-slate-200"
                >
                  <SafeImage
                    src={v.thumbnailUrl}
                    alt={v.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white">
                    <div className="text-sm font-medium line-clamp-2">{v.title}</div>
                    <div className="text-xs text-white/80 mt-1 tabular-nums">{v.views}</div>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : (
          <>
            {activeTab === 'Home' && channelVideos[0] && (
              <div className="mb-8 pb-8 border-b border-slate-200">
                <h2 className="text-base font-bold text-slate-900 mb-4">Featured upload</h2>
                <Link
                  to={`/video/${channelVideos[0].id}`}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center group"
                >
                  <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                    <SafeImage
                      src={channelVideos[0].thumbnailUrl}
                      alt={channelVideos[0].title}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                    />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-red-700 transition-colors">
                      {channelVideos[0].title}
                    </h3>
                    <div className="text-xs text-slate-500 tabular-nums">
                      {channelVideos[0].views} · {channelVideos[0].uploadDate}
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-3">
                      {channelVideos[0].description}
                    </p>
                  </div>
                </Link>
              </div>
            )}

            <h2 className="text-base font-bold text-slate-900 mb-4">Uploads</h2>
            {regularVideos.length === 0 && channelVideos.length === 0 ? (
              <div className="py-16 text-center bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-sm text-slate-600 mb-4">
                  This channel hasn’t published any videos yet.
                </p>
                {isOwner && (
                  <button
                    type="button"
                    onClick={onUploadClick}
                    className="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800"
                  >
                    Upload your first video
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
                {(activeTab === 'Videos' ? regularVideos : channelVideos).map((video) => (
                  <Link to={`/video/${video.id}`} key={video.id}>
                    <VideoCard
                      video={video}
                      onRequireAuth={onRequireAuth}
                      showDeleteOption={Boolean(isOwner)}
                      onDeleteVideo={handleDeleteVideo}
                    />
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
