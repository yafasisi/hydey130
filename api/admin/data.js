const { verifyAdmin } = require('../_lib/auth');
const { getRedis } = require('../_lib/redis');

// Default data (fallback when Redis not available)
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

async function getData() {
    const redis = getRedis();
    if (!redis) return { programs: defaultPrograms, promos: defaultPromos };

    const [programs, promos] = await Promise.all([
        redis.get('site:programs'),
        redis.get('site:promos')
    ]);

    return {
        programs: programs || defaultPrograms,
        promos: promos || defaultPromos
    };
}

async function getOrders() {
    const redis = getRedis();
    if (!redis) return [];
    return (await redis.get('site:orders')) || [];
}

const defaultContent = {
    phone: '+79299594913',
    telegram: 'hydey130',
    heroSubtitle: 'Похудела с большого веса сама — помогу и тебе!',
    heroDescription: 'Сушка, марафоны и индивидуальные программы питания. Никаких голодовок — только результат и поддержка 24/7.',
    aboutTitle: 'Привет! Я Света — и я знаю, как тяжело худеть',
    aboutText1: 'Потому что сама прошла этот путь. Сбросила 35 кг без операций, таблеток и голодовок. Теперь помогаю другим достичь того же результата.',
    aboutText2: 'Мой подход — это не диета на неделю, а изменение отношения к еде навсегда. Я не буду тебя ругать за срывы, а помогу понять, почему они происходят.',
    statYears: '5+',
    statClients: '500+',
    statKg: '-35'
};

async function getContent() {
    const redis = getRedis();
    if (!redis) return defaultContent;
    const stored = await redis.get('site:content');
    return stored ? { ...defaultContent, ...stored } : defaultContent;
}

async function saveContent(content) {
    const redis = getRedis();
    if (!redis) return false;
    await redis.set('site:content', content);
    return true;
}

async function saveOrders(orders) {
    const redis = getRedis();
    if (!redis) return false;
    await redis.set('site:orders', orders);
    return true;
}

async function saveData(key, value) {
    const redis = getRedis();
    if (!redis) return false;
    await redis.set(key, value);
    return true;
}

module.exports = async function handler(req, res) {
    try {
    const isAuthed = await verifyAdmin(req);
    if (!isAuthed) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // GET — return current data
    if (req.method === 'GET') {
        const [data, orders, content] = await Promise.all([getData(), getOrders(), getContent()]);
        return res.status(200).json({ success: true, ...data, orders, content });
    }

    // PUT — update data
    if (req.method === 'PUT') {
        const { action } = req.body || {};
        const data = await getData();

        if (action === 'updateProgram') {
            const { id, name, price, sale, saleText, icon, oldPrice, disabled, disabledText, comingSoon } = req.body;
            if (!id || !name || typeof price !== 'number') {
                return res.status(400).json({ success: false, error: 'Invalid data' });
            }
            data.programs[id] = { name, price, sale: !!sale, saleText: saleText || '', icon: icon || data.programs[id]?.icon || '', oldPrice: oldPrice || 0, disabled: !!disabled, disabledText: disabledText || '', comingSoon: !!comingSoon };
            const saved = await saveData('site:programs', data.programs);
            if (!saved) return res.status(500).json({ success: false, error: 'Redis not configured' });
            return res.status(200).json({ success: true });
        }

        if (action === 'addProgram') {
            const { id, name, price, icon } = req.body;
            if (!id || !name || typeof price !== 'number') {
                return res.status(400).json({ success: false, error: 'Invalid data' });
            }
            if (data.programs[id]) {
                return res.status(400).json({ success: false, error: 'Program already exists' });
            }
            data.programs[id] = { name, price, sale: false, saleText: '', icon: icon || '' };
            const saved = await saveData('site:programs', data.programs);
            if (!saved) return res.status(500).json({ success: false, error: 'Redis not configured' });
            return res.status(200).json({ success: true });
        }

        if (action === 'deleteProgram') {
            const { id } = req.body;
            if (!id) return res.status(400).json({ success: false, error: 'ID required' });
            delete data.programs[id];
            const saved = await saveData('site:programs', data.programs);
            if (!saved) return res.status(500).json({ success: false, error: 'Redis not configured' });
            return res.status(200).json({ success: true });
        }

        if (action === 'addPromo') {
            const { code, type, value, programs } = req.body;
            if (!code || !type || typeof value !== 'number') {
                return res.status(400).json({ success: false, error: 'Invalid data' });
            }
            data.promos[code.toUpperCase()] = { type, value, programs: programs || [] };
            const saved = await saveData('site:promos', data.promos);
            if (!saved) {
                return res.status(500).json({ success: false, error: 'Redis not configured' });
            }
            return res.status(200).json({ success: true });
        }

        if (action === 'deletePromo') {
            const { code } = req.body;
            if (!code) {
                return res.status(400).json({ success: false, error: 'Code required' });
            }
            delete data.promos[code];
            const saved = await saveData('site:promos', data.promos);
            if (!saved) {
                return res.status(500).json({ success: false, error: 'Redis not configured' });
            }
            return res.status(200).json({ success: true });
        }

        if (action === 'updateOrderStatus') {
            const { orderId, status } = req.body;
            if (!orderId || !status) return res.status(400).json({ success: false, error: 'orderId and status required' });
            const orders = await getOrders();
            const order = orders.find(o => o.orderId === orderId);
            if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
            order.status = status;
            if (status === 'paid') order.paidAt = new Date().toISOString();
            const saved = await saveOrders(orders);
            if (!saved) return res.status(500).json({ success: false, error: 'Redis not configured' });
            return res.status(200).json({ success: true });
        }

        if (action === 'deleteOrder') {
            const { orderId } = req.body;
            if (!orderId) return res.status(400).json({ success: false, error: 'orderId required' });
            const orders = await getOrders();
            const filtered = orders.filter(o => o.orderId !== orderId);
            const saved = await saveOrders(filtered);
            if (!saved) return res.status(500).json({ success: false, error: 'Redis not configured' });
            return res.status(200).json({ success: true });
        }

        if (action === 'updateOrder') {
            const { orderId, field, value } = req.body;
            const allowed = ['name','phone','email','telegram','note','status','tag'];
            if (!orderId || !field || !allowed.includes(field)) return res.status(400).json({ success: false, error: 'Invalid field' });
            const orders = await getOrders();
            const order = orders.find(o => o.orderId === orderId);
            if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
            order[field] = value || '';
            if (field === 'status' && value === 'paid' && !order.paidAt) order.paidAt = new Date().toISOString();
            const saved = await saveOrders(orders);
            if (!saved) return res.status(500).json({ success: false, error: 'Redis not configured' });
            return res.status(200).json({ success: true });
        }

        if (action === 'addNote') {
            const { orderId, note } = req.body;
            if (!orderId) return res.status(400).json({ success: false, error: 'orderId required' });
            const orders = await getOrders();
            const order = orders.find(o => o.orderId === orderId);
            if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
            order.note = note || '';
            const saved = await saveOrders(orders);
            if (!saved) return res.status(500).json({ success: false, error: 'Redis not configured' });
            return res.status(200).json({ success: true });
        }

        if (action === 'saveContent') {
            const { content } = req.body;
            if (!content) return res.status(400).json({ success: false, error: 'Content required' });
            const saved = await saveContent(content);
            if (!saved) return res.status(500).json({ success: false, error: 'Redis not configured' });
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ success: false, error: 'Unknown action' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
    } catch (error) {
        console.error('Admin data error:', error.message);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
};

// Export getData for use in other API routes
module.exports.getData = getData;
