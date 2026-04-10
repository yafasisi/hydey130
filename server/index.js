const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// ============================================
// КОНФІГУРАЦІЯ
// ============================================

const CONFIG = {
    // Telegram Bot
    TELEGRAM_BOT_TOKEN: '8186955254:AAHeV3PSG0L35dIFQ0ZIGHUTS4coeXpGpVw',
    TELEGRAM_CHAT_ID: '1130510845',
    
    // Сервер
    PORT: process.env.PORT || 3000,
    
    // Програми та ціни (в рублях)
    programs: {
        sushka: { name: 'Сушка 21 день', price: 2500 },
        marafon: { name: 'Марафон 30 дней (SALE!)', price: 1500 },
        consult: { name: 'Консультация 60 мин', price: 800 },
        vip: { name: 'VIP Ведение 2 месяца', price: 5500 }
    }
};

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors());
app.use(express.json());

// Логування
app.use((req, res, next) => {
    console.log(`📨 ${new Date().toLocaleString()} | ${req.method} ${req.path}`);
    next();
});

// ============================================
// TELEGRAM ФУНКЦІЇ
// ============================================

const TELEGRAM_API = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}`;

async function sendTelegramMessage(message) {
    try {
        const response = await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: CONFIG.TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
        console.log('✅ Telegram message sent!');
        return { success: true, messageId: response.data.result.message_id };
    } catch (error) {
        console.error('❌ Telegram error:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/', (req, res) => {
    res.json({
        status: '✅ OK',
        message: '🚀 Sveta Payment Server is running!',
        version: '1.0.0'
    });
});

// Отримати список програм
app.get('/api/programs', (req, res) => {
    const programs = Object.entries(CONFIG.programs).map(([id, data]) => ({
        id,
        ...data
    }));
    res.json({ success: true, programs });
});

// ============================================
// ГОЛОВНИЙ РОУТ - Створення замовлення
// ============================================

app.post('/api/payment/create', async (req, res) => {
    try {
        const { program, name, email, phone, telegram } = req.body;
        
        // Валідація
        if (!program || !name || !email || !phone) {
            return res.status(400).json({
                success: false,
                error: 'Заполни все обязательные поля'
            });
        }
        
        // Перевіряємо програму
        const programData = CONFIG.programs[program];
        if (!programData) {
            return res.status(400).json({
                success: false,
                error: 'Неизвестная программа'
            });
        }
        
        // Генеруємо номер замовлення
        const orderId = `SV-${Date.now().toString(36).toUpperCase()}`;
        
        // Формуємо повідомлення для Telegram
        const message = `
🆕 <b>НОВЫЙ ЗАКАЗ!</b>

📦 <b>Программа:</b> ${programData.name}
💰 <b>Сумма:</b> ${programData.price.toLocaleString()} ₽

👤 <b>Клиент:</b>
├ Имя: ${name}
├ Телефон: ${phone}
├ Email: ${email}
└ Telegram: ${telegram || 'не указан'}

🔖 <b>Заказ:</b> <code>${orderId}</code>
🕐 <b>Время:</b> ${new Date().toLocaleString('ru-RU')}

💳 Свяжись с клиентом для оплаты!
        `.trim();
        
        // Відправляємо в Telegram
        const telegramResult = await sendTelegramMessage(message);
        
        if (!telegramResult.success) {
            console.error('Failed to send telegram:', telegramResult.error);
            // Все одно повертаємо успіх клієнту
        }
        
        // Відповідь клієнту
        res.json({
            success: true,
            data: {
                orderId,
                program: programData.name,
                price: programData.price,
                message: 'Заявка отправлена! Света свяжется с тобой в ближайшее время 💚'
            }
        });
        
        console.log(`✅ Order created: ${orderId} | ${programData.name} | ${name}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка сервера. Попробуй позже.'
        });
    }
});

// Тест Telegram
app.get('/api/test-telegram', async (req, res) => {
    const result = await sendTelegramMessage('🧪 Тестовое сообщение!\\n\\nЕсли видишь это — бот работает! ✅');
    res.json(result);
});

// ============================================
// START SERVER
// ============================================

app.listen(CONFIG.PORT, () => {
    console.log('');
    console.log('🚀 ════════════════════════════════════');
    console.log('   SVETA PAYMENT SERVER');
    console.log('════════════════════════════════════');
    console.log(`📡 Server: http://localhost:${CONFIG.PORT}`);
    console.log(`📱 Telegram Chat ID: ${CONFIG.TELEGRAM_CHAT_ID}`);
    console.log('════════════════════════════════════');
    console.log('');
    console.log('📋 Endpoints:');
    console.log(`   GET  /                    - Health check`);
    console.log(`   GET  /api/programs        - List programs`);
    console.log(`   POST /api/payment/create  - Create order`);
    console.log(`   GET  /api/test-telegram   - Test bot`);
    console.log('');
});
