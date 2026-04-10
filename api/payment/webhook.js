const { sendTelegramMessage } = require('../_lib/telegram');
const { sendEmailNotification } = require('../_lib/email');
const { getRedis } = require('../_lib/redis');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { event, object } = req.body || {};

        if (event === 'payment.succeeded' && object) {
            const { metadata, amount } = object;
            const orderId = metadata?.order_id || 'N/A';
            const customerName = metadata?.customer_name || 'N/A';
            const customerPhone = metadata?.customer_phone || '';
            const customerEmail = metadata?.customer_email || '';
            const customerTelegram = metadata?.customer_telegram || '';
            const program = metadata?.program || '';
            const paid = amount?.value || '0';

            const message = `
<b>ОПЛАТА ПРОШЛА!</b>

<b>Заказ:</b> <code>${orderId}</code>
<b>Сумма:</b> ${parseFloat(paid).toLocaleString()} руб.

<b>Клиент:</b>
- Имя: ${customerName}
- Телефон: ${customerPhone}
- Email: ${customerEmail}
- Telegram: ${customerTelegram || 'не указан'}

<b>Время:</b> ${new Date().toLocaleString('ru-RU')}

Свяжись с клиентом и дай доступ к программе!
            `.trim();

            // Update order status in Redis
            try {
                const redis = getRedis();
                if (redis) {
                    const orders = (await redis.get('site:orders')) || [];
                    const order = orders.find(o => o.orderId === orderId);
                    if (order) {
                        order.status = 'paid';
                        order.paidAt = new Date().toISOString();
                        await redis.set('site:orders', orders);
                    }
                }
            } catch (e) {
                console.error('Failed to update order status:', e.message);
            }

            await Promise.all([
                sendTelegramMessage(message),
                sendEmailNotification({
                    orderId,
                    programName: program,
                    price: parseFloat(paid),
                    name: customerName,
                    phone: customerPhone,
                    email: customerEmail,
                    telegram: customerTelegram
                })
            ]);
        }

        // YooKassa expects 200 response
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Webhook error:', error.message);
        return res.status(200).json({ success: true });
    }
};
