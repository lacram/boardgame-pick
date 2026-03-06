const nodemailer = require('nodemailer');
const { buildBoardlifeMail, buildBoardlifeDigestMail } = require('./boardlifeEmailTemplateService');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.BOARDLIFE_EMAIL_FROM || process.env.EMAIL_FROM;
const EMAIL_TO = process.env.BOARDLIFE_EMAIL_TO || process.env.EMAIL_TO;

function createTransporter() {
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        throw new Error('SMTP_HOST/SMTP_USER/SMTP_PASS are required');
    }
    if (!EMAIL_FROM || !EMAIL_TO) {
        throw new Error('BOARDLIFE_EMAIL_FROM and BOARDLIFE_EMAIL_TO are required');
    }

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });
}

async function sendNotificationEmail(notification) {
    const transporter = createTransporter();
    const template = buildBoardlifeMail(notification);
    const mail = {
        from: EMAIL_FROM,
        to: EMAIL_TO,
        subject: template.subject,
        text: template.text
    };
    await transporter.sendMail(mail);
}

async function sendNotificationDigestEmail(notifications, options = {}) {
    if (!notifications || notifications.length === 0) return;

    const transporter = createTransporter();
    const template = buildBoardlifeDigestMail(notifications, options);
    const mail = {
        from: EMAIL_FROM,
        to: EMAIL_TO,
        subject: template.subject,
        text: template.text
    };
    await transporter.sendMail(mail);
}

module.exports = {
    sendNotificationEmail,
    sendNotificationDigestEmail
};
