// Session history in localStorage (per browser). Keyframes are stored as
// small thumbnails; the original video never leaves the device.
const KEY = 'hooplab.sessions.v1';
const MAX = 40;

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(list) {
  // Drop the oldest entries until it fits in the storage quota.
  let l = list.slice(0, MAX);
  while (l.length) {
    try {
      localStorage.setItem(KEY, JSON.stringify(l));
      return true;
    } catch {
      l = l.slice(0, -1);
    }
  }
  return false;
}

export function listSessions() {
  return read();
}

export function getSession(id) {
  return read().find((s) => s.id === id) || null;
}

export function saveSession(record) {
  const list = read().filter((s) => s.id !== record.id);
  list.unshift(record);
  return write(list);
}

export function deleteSession(id) {
  write(read().filter((s) => s.id !== id));
}

export function clearSessions() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
