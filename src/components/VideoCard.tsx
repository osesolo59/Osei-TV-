import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Clock, Share2, Check, User, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Video } from '../lib/data';
import { SafeImage } from './SafeImage';
import { useAuth } from '../lib/AuthContext';

interface VideoCardProps {
  video: Video;
  onRequireAuth?: () => void;
  onDeleteVideo?: (id: string) => void;
  showDeleteOption?: boolean;
}

export function VideoCard({
  video,
  onRequireAuth,
  onDeleteVideo,
  showDeleteOption = false,
}: VideoCardProps) {
  const navigate = useNavigate();
  const { user, authFetch } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleChannelClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/channel/${encodeURIComponent(video.channelName)}`);
  };

  const handleWatchLater = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      setMenuOpen(false);
      onRequireAuth?.();
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
        setSavedNotice(data.saved ? 'Saved to Watch Later' : 'Removed from Watch Later');
        setTimeout(() => {
          setSavedNotice(null);
          setMenuOpen(false);
        }, 1100);
      }
    } catch {
      setMenuOpen(false);
    }
  };

  const handleCopyShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/video/${video.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setSavedNotice('Link copied');
    setTimeout(() => {
      setSavedNotice(null);
      setMenuOpen(false);
    }, 1100);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    onDeleteVideo?.(video.id);
  };

  const isLive = video.isLive || video.duration === 'LIVE';

  return (
    <div className="flex flex-col gap-3 cursor-pointer group">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80">
        <SafeImage
          src={video.thumbnailUrl}
          alt={video.title}
          fallbackTitle={video.title}
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
        <div
          className={`absolute bottom-2 right-2 text-xs font-mono font-semibold tabular-nums px-2 py-0.5 rounded ${
            isLive ? 'bg-red-600 text-white' : 'bg-slate-950/85 text-white'
          }`}
        >
          {isLive ? 'LIVE' : video.duration}
        </div>
      </div>

      <div className="flex gap-3 pr-7 relative">
        <button
          type="button"
          onClick={handleChannelClick}
          className="shrink-0 w-9 h-9 rounded-full overflow-hidden mt-0.5 border border-slate-200 hover:opacity-85 transition-opacity"
          aria-label={`Visit ${video.channelName}`}
        >
          <SafeImage
            src={video.channelAvatar}
            alt={video.channelName}
            className="w-full h-full object-cover"
          />
        </button>

        <div className="flex flex-col min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-slate-900 line-clamp-2 leading-snug group-hover:text-red-700 transition-colors">
            {video.title}
          </h3>
          <button
            type="button"
            onClick={handleChannelClick}
            className="text-left text-sm text-slate-600 mt-1 hover:text-slate-900 truncate w-fit max-w-full"
          >
            {video.channelName}
          </button>
          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 tabular-nums">
            <span>{video.views}</span>
            <span aria-hidden="true">·</span>
            <span>{video.uploadDate}</span>
          </div>
        </div>

        <div className="absolute right-0 top-0" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            aria-label="Video actions"
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="absolute right-0 top-9 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-30"
            >
              {savedNotice ? (
                <div className="px-3.5 py-2 text-xs font-semibold text-emerald-700 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {savedNotice}
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleWatchLater}
                    className="w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                  >
                    <Clock className="w-4 h-4 text-slate-500" />
                    Save to Watch Later
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyShare}
                    className="w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                  >
                    <Share2 className="w-4 h-4 text-slate-500" />
                    Copy share link
                  </button>
                  <button
                    type="button"
                    onClick={handleChannelClick}
                    className="w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                  >
                    <User className="w-4 h-4 text-slate-500" />
                    Go to channel
                  </button>
                  {showDeleteOption && onDeleteVideo && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="w-full px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 border-t border-slate-100 mt-1 pt-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete video
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
