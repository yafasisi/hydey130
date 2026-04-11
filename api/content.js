const { getRedis } = require('./_lib/redis');

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

module.exports = async function handler(req, res) {
    const redis = getRedis();
    let content = defaultContent;
    if (redis) {
        const stored = await redis.get('site:content');
        if (stored) content = { ...defaultContent, ...stored };
    }
    return res.status(200).json({ success: true, content });
};
