import axios from 'axios';
export default {
    command: 'element',
    aliases: ['atom', 'periodictable'],
    category: 'search',
    description: 'Get information about a chemical element',
    usage: '.element <name or symbol>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const query = args?.join(' ')?.trim();
        if (!query) {
            return await sock.sendMessage(chatId, { text: `*${t('p.element.noQuery')}*\n${t('p.element.exampleUsage')}` }, { quoted: message });
        }
        try {
            const { data: json } = await axios.get(`https://api.popcat.xyz/periodic-table?element=${encodeURIComponent(query)}`);
            if (!json?.name) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.element.notFound')}` }, { quoted: message });
            }
            const text = `🧪 *${t('p.element.title')}*\n` +
                `• ${t('p.element.nameLabel')}: ${json.name}\n` +
                `• ${t('p.element.symbolLabel')}: ${json.symbol}\n` +
                `• ${t('p.element.atomicNumberLabel')}: ${json.atomic_number}\n` +
                `• ${t('p.element.atomicMassLabel')}: ${json.atomic_mass}\n` +
                `• ${t('p.element.periodLabel')}: ${json.period}\n` +
                `• ${t('p.element.phaseLabel')}: ${json.phase}\n` +
                `• ${t('p.element.discoveredByLabel')}: ${json.discovered_by || t('p.element.unknown')}\n\n` +
                `📘 ${t('p.element.summaryLabel')}:\n${json.summary}`;
            await sock.sendMessage(chatId, { image: { url: json.image }, caption: text }, { quoted: message });
        }
        catch (error) {
            console.error('Element plugin error:', error);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.element.fetchFailed')}` }, { quoted: message });
        }
    }
};
