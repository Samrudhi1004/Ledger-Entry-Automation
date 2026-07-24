function ensureUtcIso(iso) {
  if (!iso) return null;
  if (typeof iso === 'string') {
    // If ISO string has no timezone offset (no 'Z' and no timezone offset like +05:30), append 'Z' for UTC
    if (!iso.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(iso)) {
      return iso + 'Z';
    }
  }
  return iso;
}

/** Format ISO date string → "22 Jul 2026, 11:30 am" in local timezone */
export function formatDateTime(iso) {
  if (!iso) return '—';
  const dateObj = new Date(ensureUtcIso(iso));
  return dateObj.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: true,
  });
}

/** Format ISO date string → "22 Jul 2026" */
export function formatDate(iso) {
  if (!iso) return '—';
  const dateObj = new Date(ensureUtcIso(iso));
  return dateObj.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/** Format ISO date → "11:30 am" */
export function formatTime(iso) {
  if (!iso) return '—';
  const dateObj = new Date(ensureUtcIso(iso));
  return dateObj.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
    hour12: true,
  });
}

/** Show elapsed time: "3m 20s ago" */
export function timeAgo(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(ensureUtcIso(iso))) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/** Format number with fixed decimals */
export function fmt(val, decimals = 3) {
  if (val === null || val === undefined) return '—';
  return Number(val).toFixed(decimals);
}

/** Deviation with sign */
export function fmtDeviation(measured, nominal) {
  if (measured === null || nominal === null) return '—';
  const dev = measured - nominal;
  return `${dev >= 0 ? '+' : ''}${dev.toFixed(3)}`;
}

/** Auto-detect shift based on current hour */
export function currentShift() {
  const hour = new Date().getHours();
  if (hour >= 6  && hour < 14) return 'A';
  if (hour >= 14 && hour < 22) return 'B';
  return 'C';
}

/** Short session ID — last 8 chars */
export function shortId(id) {
  if (!id) return '—';
  return id.slice(-8).toUpperCase();
}
