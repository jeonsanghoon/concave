import { loginUser, authErrorMessage } from '../../lib/auth.js';
import { requireRedisOnVercel } from '../../lib/vercelCheck.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireRedisOnVercel(res)) return;

  const { username, password } = req.body ?? {};

  try {
    const result = await loginUser(username, password);
    return res.status(200).json(result);
  } catch (err) {
    const code = err.message;
    const status = ['INVALID_CREDENTIALS', 'USERNAME_LENGTH', 'USERNAME_INVALID', 'PASSWORD_LENGTH'].includes(code) ? 400 : 500;
    return res.status(status).json({ error: code, message: authErrorMessage(code) });
  }
}
