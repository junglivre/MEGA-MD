import config from '../config.js';

const hasNewsletter = Boolean(config.newsletterJid && config.newsletterName);
const channelInfo = {
    contextInfo: {
        forwardingScore: hasNewsletter ? 1 : 0,
        isForwarded: hasNewsletter,
        ...(hasNewsletter ? {
            forwardedNewsletterMessageInfo: {
                newsletterJid: config.newsletterJid,
                newsletterName: config.newsletterName,
                serverMessageId: config.newsletterServerMessageId
            }
        } : {})
    }
};
export { channelInfo };
