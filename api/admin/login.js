const crypto = require('crypto');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { email, password, pin } = req.body || {};

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminPin = process.env.ADMIN_PIN;

    if (!adminEmail || !adminPassword || !adminPin) {
        return res.status(500).json({ success: false, error: 'Admin not configured' });
    }

    // Constant-time comparison to prevent timing attacks
    const emailMatch = email && crypto.timingSafeEqual(
        Buffer.from(email.trim().toLowerCase()),
        Buffer.from(adminEmail.trim().toLowerCase())
    );
    const passMatch = password && crypto.timingSafeEqual(
        Buffer.from(String(password)),
        Buffer.from(adminPassword)
    );
    const pinMatch = pin && crypto.timingSafeEqual(
        Buffer.from(String(pin)),
        Buffer.from(adminPin)
    );

    if (!emailMatch || !passMatch || !pinMatch) {
        return res.status(401).json({ success: false, error: 'Неверные данные' });
    }

    // Generate session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24h

    // Store token using Redis if available, otherwise use signed token
    const { getRedis } = require('../_lib/redis');
    const redis = getRedis();

    if (redis) {
        await redis.set(`admin_session:${token}`, JSON.stringify({ expiry }), { ex: 86400 });
    } else {
        // Fallback: use HMAC-signed token (no storage needed)
        const hmac = crypto.createHmac('sha256', adminPassword + adminPin);
        hmac.update(String(expiry));
        const sig = hmac.digest('hex');
        return res.status(200).json({
            success: true,
            token: `${expiry}.${sig}`
        });
    }

    return res.status(200).json({ success: true, token });
};
