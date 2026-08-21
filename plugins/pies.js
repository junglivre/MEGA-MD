const BASE = 'https://shizoapi.onrender.com/api/pies';
const VALID_COUNTRIES = ['china', 'indonesia', 'japan', 'korea', 'hijab'];
async function fetchPiesImageBuffer(country) {
    const url = `${BASE}/${country}?apikey=shizo`;
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('image'))
        throw new Error('API did not return an image');
    return res.arrayBuffer().then(b => Buffer.from(b));
}
export default {
    command: 'pies',
    aliases: ['pie'],
    category: 'images',
    description: 'Get a pies image from a specific country',
    usage: `.pies <country>\nAvailable countries: ${VALID_COUNTRIES.join(', ')}`,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const t = context.t;
        const sub = (args[0] || '').toLowerCase();
        if (!sub) {
            await sock.sendMessage(chatId, {
                text: t('p.pies.usage', { countries: VALID_COUNTRIES.join(', ') })
            }, { quoted: message });
            return;
        }
        if (!VALID_COUNTRIES.includes(sub)) {
            await sock.sendMessage(chatId, {
                text: t('p.pies.unsupported', { country: sub, countries: VALID_COUNTRIES.join(', ') })
            }, { quoted: message });
            return;
        }
        try {
            const imageBuffer = await fetchPiesImageBuffer(sub);
            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: `🍰 ${t('p.pies.caption', { country: sub })}`
            }, { quoted: message });
        }
        catch (err) {
            console.error('Pies Command Error:', err);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.pies.fetchFailed')}`
            }, { quoted: message });
        }
    }
};
