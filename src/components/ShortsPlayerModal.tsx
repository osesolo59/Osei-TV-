import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ThumbsUp,
  Share2,
  ChevronUp,
  ChevronDown,
  MessageSquare,
  Check,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Video } from '../lib/data';
import { SafeImage } from './SafeImage';
import { useAuth } from '../lib/AuthContext';
import { formatCompactNumber } from '../lib/avatar';
import { useVideoKeyboardShortcuts } from '../hooks/useVideoKeyboardShortcuts';

interface ShortsPlayerModalProps {
  shorts: Video[];
  activeIndex: number | null;
  onClose: () => void;
  onChangeIndex: (idx: number) => void;
  onRequireAuth: () => void;
}

export function ShortsPlayerModal({
  shorts,
  activeIndex,
  onClose,
  onChangeIndex,
  onRequireAuth,
}: ShortsPlayerModalProps) {
  const { user, authFetch } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const [likeDeltas, setLikeDeltas] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);

  const currentShort = activeIndex !== null ? shorts[activeIndex] : null;

  useEffect(() => {
    if (activeIndex === null) return;
    setIsPlaying(true);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown' && activeIndex < shorts.length - 1) {
        onChangeIndex(activeIndex + 1);
      }
      if (e.key === 'ArrowUp' && activeIndex > 0) {
        onChangeIndex(activeIndex - 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeIndex, shorts.length, onClose, onChangeIndex]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const pauseShort = () => {
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused) {
      v.pause();
      setIsPlaying(false);
    }
  };

  const seekShortBy = (deltaSeconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    const total = Number.isFinite(v.duration) ? v.duration : 60;
    v.currentTime = Math.min(total, Math.max(0, v.currentTime + deltaSeconds));
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  useVideoKeyboardShortcuts({
    enabled: Boolean(activeIndex !== null && currentShort),
    onTogglePlay: togglePlay,
    onPause: pauseShort,
    onSeekBy: seekShortBy,
    onToggleFullScreen: () => {
      const v = videoRef.current;
      if (!v) return;
      if (!document.fullscreenElement) {
        v.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    },
    onToggleMute: toggleMute,
  });

  if (activeIndex === null || !currentShort) return null;

  const handleLike = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    const wasLiked = !!likedIds[currentShort.id];
    setLikedIds((prev) => ({ ...prev, [currentShort.id]: !wasLiked }));
    setLikeDeltas((prev) => ({
      ...prev,
      [currentShort.id]: (prev[currentShort.id] || 0) + (wasLiked ? -1 : 1),
    }));
    try {
      await authFetch(`/api/videos/${currentShort.id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: 'like' }),
      });
    } catch {
      // ignore
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/video/${currentShort.id}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const totalLikes = currentShort.likes + (likeDeltas[currentShort.id] || 0);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close Shorts player"
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-5 max-h-[90vh]">
        {/* Vertical 9:16 Viewport */}
        <div className="relative w-[min(86vw,390px)] aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
          <video
            ref={videoRef}
            key={currentShort.id}
            src={currentShort.videoUrl}
            poster={currentShort.thumbnailUrl}
            autoPlay
            loop
            playsInline
            muted={isMuted}
            onClick={togglePlay}
            className="w-full h-full object-cover cursor-pointer"
          />

          {/* Top Controls */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="pointer-events-auto w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className="pointer-events-auto w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Bottom Scrim & Metadata */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/85 via-black/45 to-transparent text-white">
            <Link
              to={`/channel/${encodeURIComponent(currentShort.channelName)}`}
              onClick={onClose}
              className="flex items-center gap-2.5 mb-2 w-fit hover:opacity-90"
            >
              <SafeImage
                src={currentShort.channelAvatar}
                alt={currentShort.channelName}
                className="w-8 h-8 rounded-full border border-white/30"
              />
              <span className="text-sm font-semibold">{currentShort.channelName}</span>
            </Link>
            <h3 className="text-sm font-medium leading-snug line-clamp-2">{currentShort.title}</h3>
          </div>
        </div>

        {/* Side Action Column */}
        <div className="flex flex-col items-center gap-4 text-white">
          <button
            type="button"
            onClick={handleLike}
            className="flex flex-col items-center gap-1"
            aria-label="Like short"
          >
            <span
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                likedIds[currentShort.id]
                  ? 'bg-red-600 text-white'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
            >
              <ThumbsUp className="w-5 h-5" />
            </span>
            <span className="text-xs font-medium tabular-nums">
              {formatCompactNumber(totalLikes)}
            </span>
          </button>

          <Link
            to={`/video/${currentShort.id}`}
            onClick={onClose}
            className="flex flex-col items-center gap-1"
            aria-label="Open full video and comments"
          >
            <span className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors">
              <MessageSquare className="w-5 h-5" />
            </span>
            <span className="text-xs font-medium">Watch</span>
          </Link>

          <button
            type="button"
            onClick={handleShare}
            className="flex flex-col items-center gap-1"
            aria-label="Share short"
          >
            <span className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors">
              {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5" />}
            </span>
            <span className="text-xs font-medium">{copied ? 'Copied' : 'Share'}</span>
          </button>

          <div className="pt-4 flex flex-col gap-2">
            <button
              type="button"
              disabled={activeIndex === 0}
              onClick={() => onChangeIndex(activeIndex - 1)}
              aria-label="Previous short"
              className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30 flex items-center justify-center"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              type="button"
              disabled={activeIndex >= shorts.length - 1}
              onClick={() => onChangeIndex(activeIndex + 1)}
              aria-label="Next short"
              className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30 flex items-center justify-center"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
