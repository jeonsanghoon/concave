import { getUserFromToken, logoutUser, getTokenFromRequest, authErrorMessage } from '../../lib/auth.js';
import { requireRedisOnVercel } from '../../lib/vercelCheck.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireRedisOnVercel(res)) return;

  const token = getTokenFromRequest(req);

  if (req.method === 'GET') {
    if (!token) return res.status(401).json({ error: 'TOKEN_REQUIRED', message: authErrorMessage('TOKEN_REQUIRED') });
    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'INVALID_TOKEN', message: authErrorMessage('INVALID_TOKEN') });
    return res.status(200).json({ user });
  }

  if (req.method === 'DELETE' || (req.method === 'POST' && req.body?.action === 'logout')) {
    await logoutUser(token);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
