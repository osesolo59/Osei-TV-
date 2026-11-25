import React, { useState, useEffect } from 'react';
import { Film } from 'lucide-react';

interface SafeImageProps {
  src?: string;
  alt?: string;
  className?: string;
  fallbackTitle?: string;
}

export function SafeImage({ src, alt, className = '', fallbackTitle }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-slate-300 select-none ${className}`}
        role="img"
        aria-label={alt || fallbackTitle || 'Media preview'}
      >
        <Film className="w-7 h-7 opacity-60 mb-1.5" />
        {fallbackTitle && (
          <span className="text-xs font-medium px-3 text-center line-clamp-2 opacity-80">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ''}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
