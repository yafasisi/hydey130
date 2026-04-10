const { getPrograms, getPromos, applyPromoSync } = require('../programs');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false });

    const { code, program } = req.body || {};

    if (!code || !program) {
        return res.status(400).json({ success: false, error: 'Укажи промокод и программу' });
    }

    const programs = await getPrograms();
    const promos = await getPromos();

    const programData = programs[program];
    if (!programData) {
        return res.status(400).json({ success: false, error: 'Неизвестная программа' });
    }

    const result = applyPromoSync(promos, code, program, programData.price);

    return res.status(200).json({
        success: result.valid,
        originalPrice: programData.price,
        newPrice: result.price,
        discount: result.discount || 0,
        description: result.description || '',
        error: result.error || null
    });
};
