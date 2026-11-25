const AVATAR_PALETTES = [
  ['#1E293B', '#F8FAFC'],
  ['#991B1B', '#FEF2F2'],
  ['#0F766E', '#F0FDFA'],
  ['#1D4ED8', '#EFF6FF'],
  ['#7C2D12', '#FFF7ED'],
  ['#4338CA', '#EEF2FF'],
  ['#047857', '#ECFDF5'],
  ['#6D28D9', '#F5F3FF'],
];

export function generateAvatarDataUri(name: string): string {
  const cleanName = (name || 'Osei').trim();
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const [bg, fg] = AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
  const parts = cleanName.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : cleanName.slice(0, 2).toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80"><rect width="80" height="80" rx="40" fill="${bg}"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="${fg}" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="700" letter-spacing="0.02em">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return num.toString();
}

export function formatRelativeDate(dateInput: string): string {
  if (!dateInput) return 'Recently';
  // If already human readable like "2 days ago", return as-is
  if (!dateInput.includes('T') && !/^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    return dateInput;
  }
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return dateInput;
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek} week${diffWeek === 1 ? '' : 's'} ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} month${diffMonth === 1 ? '' : 's'} ago`;
  const diffYear = Math.floor(diffDay / 365);
  return `${diffYear} year${diffYear === 1 ? '' : 's'} ago`;
}
