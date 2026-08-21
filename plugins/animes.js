import axios from 'axios';
const supportedAnimes = [
    'akira', 'akiyama', 'anna', 'asuna', 'ayuzawa', 'boruto', 'chiho', 'chitoge',
    'deidara', 'erza', 'elaina', 'eba', 'emilia', 'hestia', 'hinata', 'inori',
    'isuzu', 'itachi', 'itori', 'kaga', 'kagura', 'kaori', 'keneki', 'kotori',
    'kurumi', 'madara', 'mikasa', 'miku', 'minato', 'naruto', 'nezuko', 'sagiri',
    'sasuke', 'sakura'
];
function pickRandom(arr, count = 1) {
    const shuffled = arr.slice().sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}
function getAnimuMenu(t) {
    return `🎀 *${t('p.animes.title')}* 🎀\n\n` +
    '• *akira*\n' +
    '• *akiyama*\n' +
    '• *anna*\n' +
    '• *asuna*\n' +
    '• *ayuzawa*\n' +
    '• *boruto*\n' +
    '• *chiho*\n' +
    '• *chitoge*\n' +
    '• *deidara*\n' +
    '• *erza*\n' +
    '• *elaina*\n' +
    '• *eba*\n' +
    '• *emilia*\n' +
    '• *hestia*\n' +
    '• *hinata*\n' +
    '• *inori*\n' +
    '• *isuzu*\n' +
    '• *itachi*\n' +
    '• *itori*\n' +
    '• *kaga*\n' +
    '• *kagura*\n' +
    '• *kaori*\n' +
    '• *keneki*\n' +
    '• *kotori*\n' +
    '• *kurumi*\n' +
    '• *madara*\n' +
    '• *mikasa*\n' +
    '• *miku*\n' +
    '• *minato*\n' +
    '• *naruto*\n' +
    '• *nezuko*\n' +
    '• *sagiri*\n' +
    '• *sasuke*\n' +
    '• *sakura*\n\n' +
    `📌 *${t('p.animes.usageLabel')}:*\n` +
    '.animes <name>\n' +
    `${t('p.animes.exampleLabel')}: *.animes naruto*`;
}
export default {
    command: 'animes',
    aliases: ['animeimg', 'animepic'],
    category: 'menu',
    description: 'Send random anime images',
    usage: '.animes <anime_name>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const input = args[0] ? args[0] : '';
        const typeLower = input.toLowerCase();
        if (!input || !supportedAnimes.includes(typeLower)) {
            const replyText = input && !supportedAnimes.includes(typeLower)
                ? `${t('p.animes.unsupported', { name: typeLower })}\n\n`
                : '';
            return await sock.sendMessage(chatId, { text: replyText + getAnimuMenu(t) }, { quoted: message });
        }
        try {
            const apiUrl = `https://raw.githubusercontent.com/Guru322/api/Guru/BOT-JSON/anime-${typeLower}.json`;
            const res = await axios.get(apiUrl, { timeout: 15000, validateStatus: s => s < 500 });
            const images = res.data;
            if (!Array.isArray(images) || images.length === 0)
                throw new Error('No images found');
            const randomImages = pickRandom(images, Math.min(3, images.length));
            for (const img of randomImages) {
                try {
                    const imageData = await axios.get(img, { responseType: 'arraybuffer', timeout: 15000 });
                    await sock.sendMessage(chatId, { image: Buffer.from(imageData.data), caption: `_${typeLower}_` }, { quoted: message });
                }
                catch { }
            }
        }
        catch (err) {
            await sock.sendMessage(chatId, { text: `❌ ${t('p.animes.fetchFailed')}` }, { quoted: message });
        }
    }
};
