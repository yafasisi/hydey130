// ============================================
// PRICES & PROMO CODES
// Defaults used when Redis is not available
// ============================================
const { getRedis } = require('./_lib/redis');

const defaultPrograms = {
    sushka: { name: 'Сушка 21 день', price: 2500 },
    marafon: { name: 'Марафон 30 дней', price: 1800 },
    consult: { name: 'Консультация 60 мин', price: 800 },
    vip: { name: 'VIP Ведение 2 месяца', price: 5500 }
};

const defaultPromos = {
    'БЫВШИЕ': { type: 'fixed', value: 500, programs: ['marafon'] },
    'СТАРТ': { type: 'percent', value: 10, programs: [] },
    'VIP50': { type: 'fixed', value: 500, programs: ['vip'] }
};

async function getPrograms() {
    const redis = getRedis();
    if (redis) {
        const stored = await redis.get('site:programs');
        if (stored) return stored;
    }
    return defaultPrograms;
}

async function getPromos() {
    const redis = getRedis();
    if (redis) {
        const stored = await redis.get('site:promos');
        if (stored) return stored;
    }
    return defaultPromos;
}

function applyPromoSync(promoCodes, code, programId, originalPrice) {
    if (!code) return { valid: false, price: originalPrice };

    const promo = promoCodes[code.toUpperCase().trim()];
    if (!promo) return { valid: false, price: originalPrice, error: 'Промокод не найден' };

    if (promo.programs && promo.programs.length > 0 && !promo.programs.includes(programId)) {
        return { valid: false, price: originalPrice, error: 'Промокод не действует для этой программы' };
    }

    let newPrice;
    if (promo.type === 'fixed') {
        newPrice = Math.max(0, originalPrice - promo.value);
    } else {
        newPrice = Math.round(originalPrice * (1 - promo.value / 100));
    }

    return {
        valid: true,
        price: newPrice,
        discount: originalPrice - newPrice,
        description: promo.type === 'fixed'
            ? `-${promo.value} руб.`
            : `-${promo.value}%`
    };
}

module.exports = async function handler(req, res) {
    const programs = await getPrograms();
    const list = Object.entries(programs).map(([id, data]) => ({ id, ...data }));
    res.status(200).json({ success: true, programs: list });
};

module.exports.getPrograms = getPrograms;
module.exports.getPromos = getPromos;
module.exports.applyPromoSync = applyPromoSync;
module.exports.defaultPrograms = defaultPrograms;
module.exports.defaultPromos = defaultPromos;
