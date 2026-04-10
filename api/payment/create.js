const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { sendTelegramMessage } = require('../_lib/telegram');
const { sendEmailNotification } = require('../_lib/email');
const { getPrograms, getPromos, applyPromoSync } = require('../programs');
const { getRedis } = require('../_lib/redis');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { program, name, email, phone, telegram, promoCode } = req.body || {};

        // Validation
        if (!program || !name || !email || !phone) {
            return res.status(400).json({
                success: false,
                error: 'Заполни все обязательные поля'
            });
        }

        // Sanitize inputs
        const sanitize = (str) => String(str).replace(/[<>]/g, '').trim().slice(0, 200);
        const safeName = sanitize(name);
        const safeEmail = sanitize(email);
        const safePhone = sanitize(phone);
        const safeTelegram = sanitize(telegram || '');
        const safePromo = promoCode ? sanitize(promoCode) : '';

        const programs = await getPrograms();
        const promos = await getPromos();

        const programData = programs[program];
        if (!programData) {
            return res.status(400).json({ success: false, error: 'Неизвестная программа' });
        }

        // Apply promo code if provided
        const promoResult = applyPromoSync(promos, safePromo, program, programData.price);
        const finalPrice = promoResult.price;
        const promoApplied = promoResult.valid;

        const orderId = `SV-${Date.now().toString(36).toUpperCase()}`;
        const timestamp = new Date().toISOString();

        // Save order to Redis for CRM
        const orderData = {
            orderId,
            program,
            programName: programData.name,
            name: safeName,
            email: safeEmail,
            phone: safePhone,
            telegram: safeTelegram,
            promoCode: promoApplied ? safePromo : '',
            originalPrice: programData.price,
            finalPrice,
            discount: promoApplied ? programData.price - finalPrice : 0,
            status: 'pending',
            createdAt: timestamp,
            paidAt: null
        };

        try {
            const redis = getRedis();
            if (redis) {
                const orders = (await redis.get('site:orders')) || [];
                orders.unshift(orderData);
                await redis.set('site:orders', orders);
            }
        } catch (e) {
            console.error('Failed to save order to Redis:', e.message);
        }

        const shopId = process.env.YOOKASSA_SHOP_ID;
        const secretKey = process.env.YOOKASSA_SECRET_KEY;
        const siteUrl = process.env.SITE_URL || 'https://svetapush.vercel.app';

        // If YooKassa is configured — create real payment
        if (shopId && secretKey) {
            const idempotenceKey = uuidv4();

            const paymentResponse = await axios.post(
                'https://api.yookassa.ru/v3/payments',
                {
                    amount: {
                        value: `${finalPrice}.00`,
                        currency: 'RUB'
                    },
                    confirmation: {
                        type: 'redirect',
                        return_url: `${siteUrl}/success.html?order_id=${orderId}`
                    },
                    capture: true,
                    description: `${programData.name} — ${safeName}`,
                    metadata: {
                        order_id: orderId,
                        program,
                        customer_name: safeName,
                        customer_email: safeEmail,
                        customer_phone: safePhone,
                        customer_telegram: safeTelegram
                    }
                },
                {
                    auth: { username: shopId, password: secretKey },
                    headers: {
                        'Idempotence-Key': idempotenceKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const confirmationUrl = paymentResponse.data.confirmation.confirmation_url;

            // Send Telegram notification about new order
            const promoLine = promoApplied
                ? `\n<b>Промокод:</b> ${safePromo} (${promoResult.description})\n<b>Было:</b> ${programData.price.toLocaleString()} руб.`
                : '';
            const message = `
<b>НОВЫЙ ЗАКАЗ!</b>

<b>Программа:</b> ${programData.name}
<b>Сумма:</b> ${finalPrice.toLocaleString()} руб.${promoLine}

<b>Клиент:</b>
- Имя: ${safeName}
- Телефон: ${safePhone}
- Email: ${safeEmail}
- Telegram: ${safeTelegram || 'не указан'}

<b>Заказ:</b> <code>${orderId}</code>
<b>Статус:</b> Ожидает оплату
<b>Время:</b> ${new Date().toLocaleString('ru-RU')}
            `.trim();

            await Promise.all([
                sendTelegramMessage(message),
                sendEmailNotification({
                    orderId,
                    programName: programData.name,
                    price: finalPrice,
                    name: safeName,
                    phone: safePhone,
                    email: safeEmail,
                    telegram: safeTelegram
                })
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    orderId,
                    program: programData.name,
                    price: finalPrice,
                    originalPrice: promoApplied ? programData.price : null,
                    promoApplied,
                    confirmationUrl
                }
            });
        }

        // YooKassa NOT configured — just send notification (current behavior)
        const promoLine2 = promoApplied
            ? `\n<b>Промокод:</b> ${safePromo} (${promoResult.description})\n<b>Было:</b> ${programData.price.toLocaleString()} руб.`
            : '';
        const message = `
<b>НОВЫЙ ЗАКАЗ!</b>

<b>Программа:</b> ${programData.name}
<b>Сумма:</b> ${finalPrice.toLocaleString()} руб.${promoLine2}

<b>Клиент:</b>
- Имя: ${safeName}
- Телефон: ${safePhone}
- Email: ${safeEmail}
- Telegram: ${safeTelegram || 'не указан'}

<b>Заказ:</b> <code>${orderId}</code>
<b>Время:</b> ${new Date().toLocaleString('ru-RU')}

Свяжись с клиентом для оплаты!
        `.trim();

        await Promise.all([
            sendTelegramMessage(message),
            sendEmailNotification({
                orderId,
                programName: programData.name,
                price: finalPrice,
                name: safeName,
                phone: safePhone,
                email: safeEmail,
                telegram: safeTelegram
            })
        ]);

        return res.status(200).json({
            success: true,
            data: {
                orderId,
                program: programData.name,
                price: finalPrice,
                originalPrice: promoApplied ? programData.price : null,
                promoApplied,
                message: 'Заявка отправлена! Света свяжется с тобой в ближайшее время'
            }
        });

    } catch (error) {
        console.error('Payment create error:', error.response?.data || error.message);
        return res.status(500).json({
            success: false,
            error: 'Ошибка сервера. Попробуй позже.'
        });
    }
};
