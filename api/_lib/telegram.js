const axios = require('axios');

async function sendTelegramMessage(message) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.error('Telegram credentials not configured');
        return { success: false, error: 'Telegram not configured' };
    }

    try {
        const response = await axios.post(
            `https://api.telegram.org/bot${token}/sendMessage`,
            {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            }
        );
        return { success: true, messageId: response.data.result.message_id };
    } catch (error) {
        console.error('Telegram error:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

module.exports = { sendTelegramMessage };
