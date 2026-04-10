const nodemailer = require('nodemailer');

async function sendEmailNotification({ orderId, programName, price, name, phone, email, telegram }) {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const to = process.env.EMAIL_TO;

    if (!user || !pass || !to) {
        console.error('Email credentials not configured');
        return { success: false, error: 'Email not configured' };
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
    });

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #f9f9f9; border-radius: 15px;">
            <h2 style="color: #7CB342; margin-bottom: 20px;">Новый заказ! #${orderId}</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #999;">Программа</td><td style="padding: 8px 0; font-weight: bold;">${programName}</td></tr>
                <tr><td style="padding: 8px 0; color: #999;">Сумма</td><td style="padding: 8px 0; font-weight: bold;">${price.toLocaleString('ru-RU')} ₽</td></tr>
                <tr><td style="padding: 8px 0; color: #999;">Имя</td><td style="padding: 8px 0;">${name}</td></tr>
                <tr><td style="padding: 8px 0; color: #999;">Телефон</td><td style="padding: 8px 0;">${phone}</td></tr>
                <tr><td style="padding: 8px 0; color: #999;">Email</td><td style="padding: 8px 0;">${email}</td></tr>
                <tr><td style="padding: 8px 0; color: #999;">Telegram</td><td style="padding: 8px 0;">${telegram || 'не указан'}</td></tr>
            </table>
            <p style="margin-top: 20px; color: #999; font-size: 12px;">Время: ${new Date().toLocaleString('ru-RU')}</p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"Света Сайт" <${user}>`,
            to,
            subject: `Новый заказ #${orderId} — ${programName}`,
            html
        });
        return { success: true };
    } catch (error) {
        console.error('Email error:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = { sendEmailNotification };
