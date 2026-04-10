let redisClient = null;

function getRedis() {
    if (redisClient) return redisClient;

    const url = process.env.KV_REST_API_URL
        || process.env.UPSTASH_REDIS_REST_URL
        || process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN
        || process.env.UPSTASH_REDIS_REST_TOKEN
        || process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;

    if (!url || !token) return null;

    const { Redis } = require('@upstash/redis');
    redisClient = new Redis({ url, token });
    return redisClient;
}

module.exports = { getRedis };
