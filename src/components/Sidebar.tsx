import React from 'react';
import {
  Home,
  Compass,
  PlaySquare,
  Clock,
  ThumbsUp,
  History,
  PlayCircle,
  Flame,
  Gamepad2,
  Music,
  Trophy,
  Star,
  Radio,
  X,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  isCollapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  currentView,
  setCurrentView,
  isCollapsed,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (viewLabel: string) => {
    setCurrentView(viewLabel);
    onCloseMobile();
    if (viewLabel === 'Live Studio') {
      navigate('/live-studio');
      return;
    }
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  const mainLinks = [
    { icon: <Home className="w-5 h-5 shrink-0" />, label: 'Home' },
    { icon: <Compass className="w-5 h-5 shrink-0" />, label: 'Explore' },
    { icon: <PlayCircle className="w-5 h-5 shrink-0" />, label: 'Shorts' },
    { icon: <PlaySquare className="w-5 h-5 shrink-0" />, label: 'Subscriptions' },
  ];

  const secondaryLinks = [
    { icon: <History className="w-5 h-5 shrink-0" />, label: 'Library' },
    { icon: <Clock className="w-5 h-5 shrink-0" />, label: 'Watch Later' },
    { icon: <ThumbsUp className="w-5 h-5 shrink-0" />, label: 'Liked Videos' },
  ];

  const exploreLinks = [
    { icon: <Flame className="w-5 h-5 shrink-0" />, label: 'Trending' },
    { icon: <Music className="w-5 h-5 shrink-0" />, label: 'Music' },
    { icon: <Gamepad2 className="w-5 h-5 shrink-0" />, label: 'Gaming' },
    { icon: <Trophy className="w-5 h-5 shrink-0" />, label: 'Sports' },
  ];

  const renderButton = (link: { icon: React.ReactNode; label: string }, compact = false) => {
    const isRoot = location.pathname === '/';
    const isActive =
      (isRoot && currentView === link.label) ||
      (location.pathname === '/live-studio' && link.label === 'Live Studio');

    return (
      <button
        key={link.label}
        type="button"
        onClick={() => handleNavigation(link.label)}
        title={link.label}
        className={`w-full flex items-center ${
          compact ? 'flex-col justify-center gap-1 py-3 px-1' : 'gap-3.5 px-3 py-2.5'
        } rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
          isActive
            ? 'bg-slate-100 text-slate-900 font-semibold'
            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        {link.icon}
        <span className={compact ? 'text-[11px] leading-none truncate max-w-full' : 'truncate'}>
          {link.label}
        </span>
      </button>
    );
  };

  const sidebarContent = (compact = false) => (
    <div className="flex flex-col h-full">
      <div className="p-2.5 border-b border-slate-200 space-y-0.5">
        {mainLinks.map((l) => renderButton(l, compact))}
      </div>

      {!compact && (
        <>
          <div className="p-2.5 border-b border-slate-200 space-y-0.5">
            <div className="px-3 py-1.5 text-xs font-semibold text-slate-500">You</div>
            {secondaryLinks.map((l) => renderButton(l, false))}
          </div>

          <div className="p-2.5 border-b border-slate-200 space-y-0.5">
            <div className="px-3 py-1.5 text-xs font-semibold text-slate-500">Explore</div>
            {exploreLinks.map((l) => renderButton(l, false))}
          </div>

          <div className="p-2.5 space-y-0.5">
            <div className="px-3 py-1.5 text-xs font-semibold text-slate-500">Creator & Plus</div>
            {renderButton({ icon: <Radio className="w-5 h-5 shrink-0 text-red-600" />, label: 'Live Studio' }, false)}
            <button
              type="button"
              onClick={() => handleNavigation('Premium')}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                location.pathname === '/' && currentView === 'Premium'
                  ? 'bg-red-50 text-red-700 font-semibold'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Star className="w-5 h-5 shrink-0 text-amber-500" />
              <span>Osei TV Premium</span>
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`${
          isCollapsed ? 'w-20' : 'w-60'
        } bg-white border-r border-slate-200 h-[calc(100vh-56px)] sticky top-14 overflow-y-auto hidden lg:block shrink-0 transition-[width] duration-150`}
      >
        {sidebarContent(isCollapsed)}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <aside className="relative w-64 max-w-[80vw] bg-white h-full shadow-2xl z-10 overflow-y-auto">
            <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
              <span className="font-display font-bold text-base text-slate-900">Osei TV</span>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close navigation"
                className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {sidebarContent(false)}
          </aside>
        </div>
      )}
    </>
  );
}
