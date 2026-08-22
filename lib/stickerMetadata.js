import config from '../config.js';

export function getStickerPackName(customName = '') {
    return String(customName || config.packOwner || config.packname || config.botName || 'MEGA-MD').trim();
}

export function getStickerAuthor(customAuthor = '') {
    if (customAuthor)
        return String(customAuthor).trim();
    const createdAt = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: config.timeZone
    }).format(new Date());
    return `🤖 ${config.botName || 'MEGA-MD'}\n📅 ${createdAt}`;
}
