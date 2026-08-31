export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const hasKv = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  const redisConfigured = hasUpstash || hasKv;

  const envKeys = Object.keys(process.env).filter(k =>
    /REDIS|UPSTASH|KV_/i.test(k)
  );

  return res.status(200).json({
    ok: redisConfigured,
    service: 'concave-omok',
    redisConfigured,
    vercel: !!process.env.VERCEL,
    envDetected: envKeys,
    features: {
      localPvp: true,
      ai: true,
      online: redisConfigured,
      auth: redisConfigured,
      roomList: redisConfigured,
    },
  });
}
