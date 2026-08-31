import crypto from 'crypto';
import { getRedisClient } from './store.js';

const USER_PREFIX = 'omok:user:';
const USERNAME_PREFIX = 'omok:username:';
const SESSION_PREFIX = 'omok:session:';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

const memoryUsers = globalThis.__omokUsers ?? (globalThis.__omokUsers = new Map());
const memoryUsernames = globalThis.__omokUsernames ?? (globalThis.__omokUsernames = new Map());
const memorySessions = globalThis.__omokSessions ?? (globalThis.__omokSessions = new Map());

function redis() {
  return getRedisClient();
}

function authSecret() {
  return process.env.AUTH_SECRET || 'omok-dev-secret-change-me';
}

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password + authSecret()).digest('hex');
}

export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function validateUsername(username) {
  const name = (username || '').trim();
  if (name.length < 2 || name.length > 12) {
    throw new Error('USERNAME_LENGTH');
  }
  if (!/^[a-zA-Z0-9가-힣_]+$/.test(name)) {
    throw new Error('USERNAME_INVALID');
  }
  return name;
}

export function validatePassword(password) {
  if (!password || password.length < 4 || password.length > 32) {
    throw new Error('PASSWORD_LENGTH');
  }
  return password;
}

async function getUserById(id) {
  const r = redis();
  if (r) return await r.get(`${USER_PREFIX}${id}`);
  return memoryUsers.get(id) ?? null;
}

async function getUserByUsername(username) {
  const r = redis();
  let userId;
  if (r) {
    userId = await r.get(`${USERNAME_PREFIX}${username}`);
    if (!userId) return null;
    return await r.get(`${USER_PREFIX}${userId}`);
  }
  userId = memoryUsernames.get(username);
  if (!userId) return null;
  return memoryUsers.get(userId) ?? null;
}

async function saveUser(user) {
  const r = redis();
  if (r) {
    await r.set(`${USER_PREFIX}${user.id}`, user);
    await r.set(`${USERNAME_PREFIX}${user.username}`, user.id);
    return;
  }
  memoryUsers.set(user.id, user);
  memoryUsernames.set(user.username, user.id);
}

async function saveSession(token, session) {
  const r = redis();
  if (r) {
    await r.set(`${SESSION_PREFIX}${token}`, session, { ex: SESSION_TTL });
    return;
  }
  memorySessions.set(token, session);
}

async function getSession(token) {
  if (!token) return null;
  const r = redis();
  if (r) return await r.get(`${SESSION_PREFIX}${token}`);
  return memorySessions.get(token) ?? null;
}

async function deleteSession(token) {
  if (!token) return;
  const r = redis();
  if (r) {
    await r.del(`${SESSION_PREFIX}${token}`);
    return;
  }
  memorySessions.delete(token);
}

export async function registerUser(username, password) {
  const name = validateUsername(username);
  const pass = validatePassword(password);

  if (await getUserByUsername(name)) {
    throw new Error('USER_EXISTS');
  }

  const user = {
    id: crypto.randomUUID(),
    username: name,
    passwordHash: hashPassword(pass),
    createdAt: Date.now(),
  };

  await saveUser(user);
  return user;
}

export async function loginUser(username, password) {
  const name = validateUsername(username);
  const pass = validatePassword(password);

  const user = await getUserByUsername(name);
  if (!user || user.passwordHash !== hashPassword(pass)) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const token = generateToken();
  const session = {
    userId: user.id,
    username: user.username,
    createdAt: Date.now(),
  };

  await saveSession(token, session);
  return { token, user: { id: user.id, username: user.username } };
}

export async function getUserFromToken(token) {
  const session = await getSession(token);
  if (!session) return null;

  const user = await getUserById(session.userId);
  if (!user) {
    await deleteSession(token);
    return null;
  }

  return { id: user.id, username: user.username };
}

export async function logoutUser(token) {
  await deleteSession(token);
}

export function getTokenFromRequest(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return req.query?.token || req.body?.token || null;
}

export function authErrorMessage(code) {
  const messages = {
    USER_EXISTS: '이미 사용 중인 아이디입니다.',
    INVALID_CREDENTIALS: '아이디 또는 비밀번호가 틀립니다.',
    USERNAME_LENGTH: '아이디는 2~12자입니다.',
    USERNAME_INVALID: '아이디는 한글, 영문, 숫자, _ 만 가능합니다.',
    PASSWORD_LENGTH: '비밀번호는 4~32자입니다.',
    TOKEN_REQUIRED: '로그인이 필요합니다.',
    INVALID_TOKEN: '로그인이 만료되었습니다.',
  };
  return messages[code] || code;
}
