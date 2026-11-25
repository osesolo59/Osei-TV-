import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ThumbsUp,
  ThumbsDown,
  Share2,
  Download,
  Clock,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RectangleHorizontal,
  PictureInPicture2,
  Check,
  Radio,
  Copy,
  X,
  RotateCcw,
} from 'lucide-react';
import { VideoCard } from './VideoCard';
import { LiveChat } from './LiveChat';
import { SafeImage } from './SafeImage';
import { Video, Comment } from '../lib/data';
import { useAuth } from '../lib/AuthContext';
import { formatCompactNumber, generateAvatarDataUri } from '../lib/avatar';
import { useVideoKeyboardShortcuts } from '../hooks/useVideoKeyboardShortcuts';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

interface VideoPageProps {
  videos: Video[];
  onRequireAuth: () => void;
  onVideosMutated: () => void;
}

export function VideoPage({ videos, onRequireAuth, onVideosMutated }: VideoPageProps) {
  const { id } = useParams<{ id: string }>();
  const { user, authFetch } = useAuth();

  const fallbackVideo = videos.find((v) => v.id === id) || null;
  const [video, setVideo] = useState<Video | null>(fallbackVideo);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [channelSubscribers, setChannelSubscribers] = useState(12000);
  const [userReaction, setUserReaction] = useState<'like' | 'dislike' | null>(null);
  const [isWatchLater, setIsWatchLater] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [suggestedTab, setSuggestedTab] = useState<'All' | 'Related' | 'Channel' | 'Recent'>('All');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareAtCurrentTime, setShareAtCurrentTime] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isTheater, setIsTheater] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [mediaError, setMediaError] = useState(false);
  const [livePreviewFrame, setLivePreviewFrame] = useState<string | null>(null);
  const [shortcutHud, setShortcutHud] = useState<string | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hudTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 2200);
  }, []);

  const showShortcutHud = useCallback((label: string) => {
    setShortcutHud(label);
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = setTimeout(() => setShortcutHud(null), 900);
  }, []);

  // Fetch authoritative video details, user reaction state, and comments
  useEffect(() => {
    if (!id) return;
    let active = true;
    setMediaError(false);
    setLivePreviewFrame(null);
    window.scrollTo(0, 0);

    const match = videos.find((v) => v.id === id);
    if (match) setVideo(match);

    authFetch(`/api/videos/${encodeURIComponent(id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setVideo(data);
        setChannelSubscribers(data.channelSubscribers ?? 12000);
        setUserReaction(data.userReaction ?? null);
        setIsWatchLater(Boolean(data.isWatchLater));
        setIsSubscribed(Boolean(data.isSubscribed));
      })
      .catch(() => {});

    fetch(`/api/videos/${encodeURIComponent(id)}/comments`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (active && Array.isArray(data)) setComments(data);
      })
      .catch(() => {});

    // Increment view count & log history
    authFetch(`/api/videos/${encodeURIComponent(id)}/view`, { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.views) {
          setVideo((prev) => (prev ? { ...prev, views: data.views, viewCount: data.viewCount } : prev));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [id, user?.id]);

  // Listen for live frames if watching a local LiveStudio broadcast
  useEffect(() => {
    if (!video || video.videoUrl !== 'LIVE_STREAM') return;
    const channel = new BroadcastChannel('osei-tv-live');
    channel.onmessage = (event) => {
      if (event.data?.type === 'frame' && event.data?.frame) {
        setLivePreviewFrame(event.data.frame);
      }
    };
    return () => channel.close();
  }, [video?.id, video?.videoUrl]);

  // Video DOM event listeners
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !video || video.videoUrl === 'LIVE_STREAM') return;

    v.volume = volume;
    v.muted = isMuted;
    v.playbackRate = playbackRate;

    const playAttempt = v.play();
    if (playAttempt !== undefined) {
      playAttempt.catch(() => setIsPlaying(false));
    }

    const updateTime = () => setCurrentTime(v.currentTime);
    const updateDuration = () => setDuration(v.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolume = () => {
      setVolume(v.volume);
      setIsMuted(v.muted);
    };

    v.addEventListener('timeupdate', updateTime);
    v.addEventListener('loadedmetadata', updateDuration);
    v.addEventListener('play', handlePlay);
    v.addEventListener('pause', handlePause);
    v.addEventListener('volumechange', handleVolume);

    return () => {
      v.removeEventListener('timeupdate', updateTime);
      v.removeEventListener('loadedmetadata', updateDuration);
      v.removeEventListener('play', handlePlay);
      v.removeEventListener('pause', handlePause);
      v.removeEventListener('volumechange', handleVolume);
    };
  }, [video?.id, video?.videoUrl]);

  useEffect(() => {
    const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const togglePlay = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
    }
  }, []);

  const toggleFullScreen = useCallback(async () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      await playerContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  }, []);

  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch {
      showNotice('Picture-in-Picture unavailable for this stream');
    }
  };

  const cyclePlaybackRate = () => {
    const rates = [0.5, 1, 1.25, 1.5, 2];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  };

  const pauseVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused) {
      v.pause();
      showShortcutHud('Paused');
    }
  }, [showShortcutHud]);

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      const v = videoRef.current;
      if (!v) return;
      const maxTime = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : duration;
      v.currentTime = Math.min(maxTime || 0, Math.max(0, v.currentTime + deltaSeconds));
      showShortcutHud(deltaSeconds > 0 ? `+${deltaSeconds}s` : `${deltaSeconds}s`);
    },
    [duration, showShortcutHud]
  );

  const seekPercent = useCallback(
    (percent: number) => {
      const v = videoRef.current;
      if (!v) return;
      const total = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : duration;
      if (!total) return;
      v.currentTime = (percent / 100) * total;
      showShortcutHud(`${percent}%`);
    },
    [duration, showShortcutHud]
  );

  const stepVolume = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v) return;
      const next = Math.min(1, Math.max(0, Number((v.volume + delta).toFixed(2))));
      v.volume = next;
      v.muted = next === 0;
      showShortcutHud(`Volume ${Math.round(next * 100)}%`);
    },
    [showShortcutHud]
  );

  useVideoKeyboardShortcuts({
    enabled: Boolean(video && video.videoUrl !== 'LIVE_STREAM' && !shareOpen),
    onTogglePlay: () => {
      const v = videoRef.current;
      if (v) showShortcutHud(v.paused ? 'Playing' : 'Paused');
      togglePlay();
    },
    onPause: pauseVideo,
    onSeekBy: seekBy,
    onSeekPercent: seekPercent,
    onToggleFullScreen: toggleFullScreen,
    onToggleMute: () => {
      const v = videoRef.current;
      if (v) showShortcutHud(v.muted ? 'Unmuted' : 'Muted');
      toggleMute();
    },
    onToggleTheater: () => {
      setIsTheater((prev) => {
        showShortcutHud(prev ? 'Default view' : 'Theater mode');
        return !prev;
      });
    },
    onVolumeStep: stepVolume,
  });

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    } else {
      handleMouseMove();
    }
  }, [isPlaying]);

  if (!video) {
    return (
      <div className="max-w-3xl mx-auto py-20 px-4 text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Video not found</h2>
        <p className="text-sm text-slate-500 mb-6">
          This broadcast may have ended or been removed by the creator.
        </p>
        <Link
          to="/"
          className="inline-flex items-center px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  const isLive = video.isLive || video.duration === 'LIVE';

  const handleReact = async (reaction: 'like' | 'dislike') => {
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      const res = await authFetch(`/api/videos/${encodeURIComponent(video.id)}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction }),
      });
      if (res.ok) {
        const data = await res.json();
        setUserReaction(data.userReaction);
        setVideo((prev) => (prev ? { ...prev, likes: data.likes, dislikes: data.dislikes } : prev));
        onVideosMutated();
      }
    } catch {
      // ignore
    }
  };

  const handleToggleSubscribe = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      const res = await authFetch('/api/subscriptions/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName: video.channelName }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsSubscribed(data.isSubscribed);
        setChannelSubscribers(data.subscribers);
        showNotice(data.isSubscribed ? `Subscribed to ${video.channelName}` : 'Unsubscribed');
      }
    } catch {
      // ignore
    }
  };

  const handleToggleWatchLater = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      const res = await authFetch('/api/watch-later/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsWatchLater(data.saved);
        showNotice(data.saved ? 'Saved to Watch Later' : 'Removed from Watch Later');
      }
    } catch {
      // ignore
    }
  };

  const handleDownload = () => {
    if (!video.videoUrl || video.videoUrl === 'LIVE_STREAM') {
      showNotice('Live streams cannot be downloaded while broadcasting');
      return;
    }
    const a = document.createElement('a');
    a.href = video.videoUrl;
    a.download = `${video.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showNotice('Download started');
  };

  const handleCopyShareLink = () => {
    const base = `${window.location.origin}/video/${video.id}`;
    const fullUrl =
      shareAtCurrentTime && Math.floor(currentTime) > 0
        ? `${base}?t=${Math.floor(currentTime)}`
        : base;
    navigator.clipboard?.writeText(fullUrl).catch(() => {});
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 1800);
  };

  const handleCommentSubmit = async (e: React.FormEvent, parentId: string | null = null) => {
    e.preventDefault();
    const text = (parentId ? replyText : newComment).trim();
    if (!text) return;
    if (!user) {
      onRequireAuth();
      return;
    }

    try {
      const res = await authFetch(`/api/videos/${encodeURIComponent(video.id)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, parentId }),
      });
      if (res.ok) {
        const created = await res.json();
        setComments((prev) => [created, ...prev]);
        if (parentId) {
          setReplyText('');
          setReplyingTo(null);
        } else {
          setNewComment('');
        }
      }
    } catch {
      // ignore
    }
  };

  const handleLikeComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}/like`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, likes: data.likes } : c))
        );
      }
    } catch {
      // ignore
    }
  };

  // Suggested filtering
  const otherVideos = videos.filter((v) => v.id !== video.id);
  const filteredSuggested =
    suggestedTab === 'Related'
      ? otherVideos.filter((v) => v.category === video.category)
      : suggestedTab === 'Channel'
      ? otherVideos.filter((v) => v.channelName === video.channelName)
      : suggestedTab === 'Recent'
      ? [...otherVideos].reverse()
      : otherVideos;
  const suggestedVideos = (filteredSuggested.length > 0 ? filteredSuggested : otherVideos).slice(0, 10);

  const playerElement = (
    <div
      ref={playerContainerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className={`w-full aspect-video bg-black overflow-hidden relative group flex items-center justify-center text-white ${
        isTheater ? 'max-h-[78vh] rounded-none' : 'rounded-xl shadow-sm'
      }`}
    >
      {video.videoUrl === 'LIVE_STREAM' ? (
        <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950">
          {livePreviewFrame ? (
            <img
              src={livePreviewFrame}
              alt="Live broadcast feed"
              className="w-full h-full object-contain"
            />
          ) : (
            <SafeImage
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover opacity-35"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/30 flex flex-col items-center justify-center p-6 text-center">
            {!livePreviewFrame && (
              <>
                <div className="w-14 h-14 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center mb-4">
                  <Radio className="w-7 h-7 text-red-500" />
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-red-600 text-white text-xs font-mono font-semibold mb-3">
                  LIVE BROADCAST
                </div>
                <h2 className="text-lg sm:text-xl font-bold max-w-md">{video.title}</h2>
                <p className="text-sm text-slate-300 mt-1.5 max-w-md">
                  Hosted by {video.channelName}. Join the live chat on the right or launch your own broadcast from Live Studio.
                </p>
              </>
            )}
          </div>
        </div>
      ) : mediaError ? (
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm text-slate-300 mb-4">
            Unable to load video stream right now.
          </p>
          <button
            type="button"
            onClick={() => {
              setMediaError(false);
              videoRef.current?.load();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-100"
          >
            <RotateCcw className="w-4 h-4" />
            Retry playback
          </button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            key={video.id}
            src={video.videoUrl}
            poster={video.thumbnailUrl}
            autoPlay
            playsInline
            onError={() => setMediaError(true)}
            className="w-full h-full object-contain z-0"
          />

          <div
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={togglePlay}
            onDoubleClick={toggleFullScreen}
          />

          {!isPlaying && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="bg-black/55 rounded-full p-5 backdrop-blur-sm border border-white/15">
                <Play className="w-12 h-12 text-white fill-current ml-1" />
              </div>
            </div>
          )}

          {shortcutHud && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-black/75 backdrop-blur-sm text-white text-xs font-mono font-semibold px-3 py-1.5 rounded-lg border border-white/15">
              {shortcutHud}
            </div>
          )}

          {/* Controls Overlay */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3 sm:p-4 transition-opacity duration-200 z-20 ${
              showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="mb-2.5">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                aria-label="Seek video"
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (videoRef.current) videoRef.current.currentTime = val;
                }}
                className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
            </div>

            <div className="flex items-center justify-between text-white gap-2">
              <div className="flex items-center gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="hover:text-red-400 transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current" />
                  )}
                </button>

                <div className="flex items-center gap-2 group/volume">
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                    className="hover:text-red-400 transition-colors"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    aria-label="Volume"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (videoRef.current) {
                        videoRef.current.volume = val;
                        videoRef.current.muted = val === 0;
                      }
                    }}
                    className="w-16 sm:w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                </div>

                {isLive ? (
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-red-600 rounded">
                    LIVE
                  </span>
                ) : (
                  <span className="text-xs sm:text-sm font-mono tabular-nums">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={cyclePlaybackRate}
                  title="Playback speed"
                  className="px-2 py-1 text-xs font-mono font-semibold bg-white/15 hover:bg-white/25 rounded transition-colors"
                >
                  {playbackRate}x
                </button>
                <button
                  type="button"
                  onClick={togglePiP}
                  aria-label="Picture in Picture"
                  title="Picture in Picture"
                  className="hidden sm:inline-flex hover:text-red-400 transition-colors"
                >
                  <PictureInPicture2 className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsTheater((prev) => !prev)}
                  aria-label="Theater mode"
                  title="Theater mode (T)"
                  className={`hidden lg:inline-flex transition-colors ${
                    isTheater ? 'text-red-400' : 'hover:text-red-400'
                  }`}
                >
                  <RectangleHorizontal className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={toggleFullScreen}
                  aria-label="Toggle fullscreen"
                  className="hover:text-red-400 transition-colors"
                >
                  {isFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-white pb-12">
      {actionToast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[110] bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-xl">
          {actionToast}
        </div>
      )}

      {isTheater && <div className="w-full bg-black">{playerElement}</div>}

      <div className="max-w-[1520px] mx-auto flex flex-col lg:flex-row gap-6 p-4 lg:p-6">
        {/* Main Watch Column */}
        <div className="flex-1 min-w-0">
          {!isTheater && playerElement}

          {/* Video Header & Action Row */}
          <div className="mt-4">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
              {video.title}
            </h1>

            <div className="flex flex-col md:flex-row md:items-center justify-between mt-3.5 gap-4">
              <div className="flex items-center gap-3.5">
                <Link to={`/channel/${encodeURIComponent(video.channelName)}`} className="shrink-0">
                  <SafeImage
                    src={video.channelAvatar}
                    alt={video.channelName}
                    className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                  />
                </Link>
                <div className="min-w-0">
                  <Link
                    to={`/channel/${encodeURIComponent(video.channelName)}`}
                    className="font-bold text-slate-900 hover:text-red-700 transition-colors block truncate"
                  >
                    {video.channelName}
                  </Link>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {formatCompactNumber(channelSubscribers)} subscribers
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSubscribe}
                  className={`ml-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    isSubscribed
                      ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {isSubscribed ? 'Subscribed' : 'Subscribe'}
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                <div className="flex items-center bg-slate-100 rounded-full overflow-hidden shrink-0">
                  <button
                    type="button"
                    onClick={() => handleReact('like')}
                    className={`flex items-center gap-2 px-4 py-2 border-r border-slate-200 text-sm font-medium transition-colors ${
                      userReaction === 'like'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span className="tabular-nums">{formatCompactNumber(video.likes)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReact('dislike')}
                    aria-label="Dislike"
                    className={`px-3.5 py-2 transition-colors ${
                      userReaction === 'dislike'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full font-medium text-sm whitespace-nowrap shrink-0 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>

                <button
                  type="button"
                  onClick={handleToggleWatchLater}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap shrink-0 transition-colors ${
                    isWatchLater
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  {isWatchLater ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  {isWatchLater ? 'Saved' : 'Save'}
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full font-medium text-sm whitespace-nowrap shrink-0 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>

            {/* Description Panel */}
            <div className="mt-4 bg-slate-100/80 border border-slate-200/80 rounded-xl p-4 text-sm">
              <div className="font-semibold text-slate-900 mb-1.5 flex items-center gap-2 tabular-nums">
                <span>{video.views}</span>
                <span aria-hidden="true">·</span>
                <span>{video.uploadDate}</span>
                {video.category && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-600 font-medium">{video.category}</span>
                  </>
                )}
              </div>
              <p
                className={`whitespace-pre-line text-slate-700 leading-relaxed ${
                  descExpanded ? '' : 'line-clamp-3'
                }`}
              >
                {video.description || 'No description provided.'}
              </p>
              {(video.description?.length || 0) > 120 && (
                <button
                  type="button"
                  onClick={() => setDescExpanded((prev) => !prev)}
                  className="mt-2 text-xs font-semibold text-slate-900 hover:underline"
                >
                  {descExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="mt-7 mb-8">
            <h2 className="text-lg font-bold text-slate-900 mb-5 tabular-nums">
              {comments.length} Comment{comments.length === 1 ? '' : 's'}
            </h2>

            <div className="flex gap-3.5 mb-7">
              <SafeImage
                src={user?.avatar || generateAvatarDataUri('Guest')}
                alt={user?.username || 'Guest'}
                className="w-10 h-10 rounded-full shrink-0 border border-slate-200"
              />
              <form onSubmit={(e) => handleCommentSubmit(e, null)} className="flex-1">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onFocus={() => {
                    if (!user) onRequireAuth();
                  }}
                  placeholder={user ? 'Add a comment...' : 'Sign in to add a comment...'}
                  className="w-full border-b border-slate-300 pb-2 mb-2.5 focus:border-slate-900 outline-none bg-transparent transition-colors text-sm"
                />
                {newComment && (
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setNewComment('')}
                      className="px-4 py-1.5 text-sm font-medium rounded-full text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newComment.trim()}
                      className="px-4 py-1.5 text-sm font-medium bg-slate-900 text-white rounded-full hover:bg-slate-800 disabled:opacity-50"
                    >
                      Comment
                    </button>
                  </div>
                )}
              </form>
            </div>

            <div className="flex flex-col gap-5">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3.5">
                  <SafeImage
                    src={comment.avatar}
                    alt={comment.user}
                    className="w-9 h-9 rounded-full shrink-0 border border-slate-200"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-sm text-slate-900">
                        @{comment.user}
                      </span>
                      <span className="text-xs text-slate-500">{comment.date}</span>
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed mb-2 break-words">
                      {comment.text}
                    </p>
                    <div className="flex items-center gap-3 text-slate-600">
                      <button
                        type="button"
                        onClick={() => handleLikeComment(comment.id)}
                        className="flex items-center gap-1.5 text-xs hover:text-slate-900 py-1 px-2 -ml-2 rounded-full hover:bg-slate-100"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span className="tabular-nums">{comment.likes || 0}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!user) return onRequireAuth();
                          setReplyingTo(replyingTo === comment.id ? null : comment.id);
                          setReplyText(`@${comment.user} `);
                        }}
                        className="text-xs font-medium hover:bg-slate-100 px-3 py-1 rounded-full"
                      >
                        Reply
                      </button>
                    </div>

                    {replyingTo === comment.id && (
                      <form
                        onSubmit={(e) => handleCommentSubmit(e, comment.id)}
                        className="mt-3 flex gap-2"
                      >
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Write a reply..."
                          className="flex-1 border-b border-slate-300 pb-1 text-sm outline-none focus:border-slate-900"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setReplyingTo(null)}
                          className="px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-full"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!replyText.trim()}
                          className="px-3 py-1 text-xs font-medium bg-slate-900 text-white rounded-full disabled:opacity-50"
                        >
                          Reply
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live Chat + Suggested Videos */}
        <aside className="w-full lg:w-[370px] xl:w-[410px] shrink-0 flex flex-col gap-4">
          {isLive && <LiveChat videoId={video.id} />}

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {(
              [
                { key: 'All', label: 'All' },
                { key: 'Related', label: 'Related' },
                { key: 'Channel', label: 'From this channel' },
                { key: 'Recent', label: 'Recently uploaded' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSuggestedTab(tab.key)}
                className={`whitespace-nowrap shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  suggestedTab === tab.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {suggestedVideos.map((v) => {
              const vLive = v.isLive || v.duration === 'LIVE';
              return (
                <Link
                  to={`/video/${v.id}`}
                  key={v.id}
                  className="flex gap-2.5 cursor-pointer group"
                >
                  <div className="relative w-40 min-w-[160px] aspect-video rounded-lg overflow-hidden bg-slate-100 border border-slate-200/80">
                    <SafeImage
                      src={v.thumbnailUrl}
                      alt={v.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div
                      className={`absolute bottom-1 right-1 text-[11px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded ${
                        vLive ? 'bg-red-600 text-white' : 'bg-slate-950/85 text-white'
                      }`}
                    >
                      {vLive ? 'LIVE' : v.duration}
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug group-hover:text-red-700 transition-colors">
                      {v.title}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 truncate">{v.channelName}</p>
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      {v.views} · {v.uploadDate}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Share Modal */}
      {shareOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-900">Share video</h3>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 border border-slate-300 rounded-xl p-2 bg-slate-50">
              <input
                type="text"
                readOnly
                value={
                  shareAtCurrentTime && Math.floor(currentTime) > 0
                    ? `${window.location.origin}/video/${video.id}?t=${Math.floor(currentTime)}`
                    : `${window.location.origin}/video/${video.id}`
                }
                className="flex-1 bg-transparent text-xs font-mono text-slate-700 outline-none px-1.5"
              />
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="px-3.5 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5 shrink-0"
              >
                {copiedShare ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedShare ? 'Copied' : 'Copy'}
              </button>
            </div>
            {!isLive && (
              <label className="flex items-center gap-2 mt-4 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shareAtCurrentTime}
                  onChange={(e) => setShareAtCurrentTime(e.target.checked)}
                  className="rounded border-slate-300 accent-red-600"
                />
                Start at {formatTime(currentTime)}
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
