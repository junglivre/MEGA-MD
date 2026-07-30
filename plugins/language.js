import config from '../config.js';
import { createTranslator, getUserLanguage, languageLabel, locales, setUserLanguage } from '../lib/i18n.js';

export default {
    command: 'idioma',
    aliases: ['language', 'lang', 'lingua', 'língua'],
    category: 'general',
    description: 'Choose the language used by the bot',
    usage: '.idioma [pt-br|en|es]',
    async handler(sock, message, args, context) {
        const userId = context.senderId || message.key.participant || message.key.remoteJid;
        const chatId = context.chatId || message.key.remoteJid;
        const current = await getUserLanguage(userId);
        const t = createTranslator(current);
        if (!args.length) {
            return sock.sendMessage(chatId, {
                text: `🌐 *${t('language')}*\n\n${t('currentLanguage')}: *${languageLabel(current)}*\n\n${t('languageUsage', { prefix: config.prefix })}\n\n✅ pt-BR\n✅ en\n✅ es`,
                ...context.channelInfo
            }, { quoted: message });
        }
        const selected = await setUserLanguage(userId, args[0]);
        if (!selected) {
            return sock.sendMessage(chatId, {
                text: t('invalidLanguage', { languages: locales.join(', ') }),
                ...context.channelInfo
            }, { quoted: message });
        }
        const next = createTranslator(selected);
        return sock.sendMessage(chatId, {
            text: `✅ ${next('languageChanged', { language: languageLabel(selected) })}`,
            ...context.channelInfo
        }, { quoted: message });
    }
};
