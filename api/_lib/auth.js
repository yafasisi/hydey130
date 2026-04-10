const crypto = require('crypto');
const { getRedis } = require('./redis');

async function verifyAdmin(req) {
    const header = req.headers.authorization || '';
    const token = header.replace('Bearer ', '').trim();

    if (!token) return false;

    const redis = getRedis();

    if (redis) {
        // Redis-based session
        const session = await redis.get(`admin_session:${token}`);
        if (!session) return false;
        const parsed = typeof session === 'string' ? JSON.parse(session) : session;
        return parsed.expiry > Date.now();
    }

    // Fallback: HMAC-signed token
    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const [expiry, sig] = parts;
    if (Number(expiry) < Date.now()) return false;

    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminPin = process.env.ADMIN_PIN;
    if (!adminPassword || !adminPin) return false;

    const hmac = crypto.createHmac('sha256', adminPassword + adminPin);
    hmac.update(expiry);
    const expected = hmac.digest('hex');

    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

module.exports = { verifyAdmin };
