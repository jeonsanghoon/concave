const TOKEN_KEY = 'omok-auth-token';
const GUEST_KEY = 'omok-guest-mode';

let currentUser = null;

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function isGuestMode() {
  return localStorage.getItem(GUEST_KEY) === '1';
}

export function setGuestMode(value) {
  if (value) localStorage.setItem(GUEST_KEY, '1');
  else localStorage.removeItem(GUEST_KEY);
}

export function getCurrentUser() {
  return currentUser;
}

function authHeaders() {
  const token = getAuthToken();
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

async function parseError(res, fallback) {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.message || err.error || fallback);
}

export async function register(username, password) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) await parseError(res, '회원가입 실패');
  return res.json();
}

export async function login(username, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) await parseError(res, '로그인 실패');
  const data = await res.json();
  setAuthToken(data.token);
  currentUser = data.user;
  setGuestMode(false);
  return data.user;
}

export async function logout() {
  const token = getAuthToken();
  if (token) {
    await fetch('/api/auth/me', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  setAuthToken(null);
  currentUser = null;
  setGuestMode(false);
}

export async function checkSession() {
  const token = getAuthToken();
  if (!token) {
    currentUser = null;
    return null;
  }

  const res = await fetch('/api/auth/me', { headers: authHeaders() });
  if (!res.ok) {
    setAuthToken(null);
    currentUser = null;
    return null;
  }

  const data = await res.json();
  currentUser = data.user;
  setGuestMode(false);
  return data.user;
}

export function enterGuestMode() {
  setAuthToken(null);
  currentUser = null;
  setGuestMode(true);
}

export function isLoggedIn() {
  return !!currentUser;
}

export function requireLogin() {
  if (!isLoggedIn()) throw new Error('LOGIN_REQUIRED');
}
