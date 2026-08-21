import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const acrcloud = createRequire(import.meta.url)('acrcloud');
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
const acr = new acrcloud({
    host: 'identify-eu-west-1.acrcloud.com',
    access_key: 'c33c767d683f78bd17d4bd4991955d81',
    access_secret: 'bvgaIAEtADBTbLwiPGYlxupWqkNGIjT7J9Ag2vIu',
});
/* ================= MEDIA HELPERS ================= */
function getAudioOrVideo(message) {
    const m = message.message || {};
    if (m.audioMessage)
        return { msg: m.audioMessage, type: 'audio', ext: '.mp3' };
    if (m.videoMessage)
        return { msg: m.videoMessage, type: 'video', ext: '.mp4' };
    const quoted = m.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted)
        return null;
    if (quoted.audioMessage)
        return { msg: quoted.audioMessage, type: 'audio', ext: '.mp3' };
    if (quoted.videoMessage)
        return { msg: quoted.videoMessage, type: 'video', ext: '.mp4' };
    return null;
}
async function downloadMedia(msg, type) {
    const stream = await downloadContentFromMessage(msg, type);
    const chunks = [];
    for await (const chunk of stream)
        chunks.push(chunk);
    return Buffer.concat(chunks);
}
/* ================= COMMAND MODULE ================= */
export default {
    command: 'shazam',
    aliases: ['whatmusic', 'songid'],
    category: 'info',
    description: 'Identify a song from audio or video',
    usage: '.shazam (reply to audio or video)',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        try {
            const media = getAudioOrVideo(message);
            if (!media) {
                return await sock.sendMessage(chatId, { text: `⚠️ *${t('p.shazam.noMedia')}*` }, { quoted: message });
            }
            const buffer = await downloadMedia(media.msg, media.type);
            const tmpDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tmpDir))
                fs.mkdirSync(tmpDir, { recursive: true });
            const tmpPath = path.join(tmpDir, `${Date.now()}${media.ext}`);
            fs.writeFileSync(tmpPath, buffer);
            const res = await acr.identify(fs.readFileSync(tmpPath));
            fs.unlinkSync(tmpPath);
            const { code, msg } = res.status;
            if (code !== 0)
                throw msg;
            const music = res.metadata.music?.[0];
            if (!music)
                throw new Error('No match found');
            const notFound = t('p.shazam.notFound');
            const text = `
${t('p.shazam.resultHeader')}
• 📌 *${t('p.shazam.title')}*: ${music.title || notFound}
• 👨‍🎤 *${t('p.shazam.artist')}*: ${music.artists?.map((a) => a.name).join(', ') || notFound}
• 💾 *${t('p.shazam.album')}*: ${music.album?.name || notFound}
• 🌐 *${t('p.shazam.genre')}*: ${music.genres?.map((g) => g.name).join(', ') || notFound}
• 📆 *${t('p.shazam.releaseDate')}*: ${music.release_date || notFound}
`.trim();
            await sock.sendMessage(chatId, { text }, { quoted: message });
        }
        catch (err) {
            console.error('[SHZ]', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.shazam.errorLabel')}: ${err}` }, { quoted: message });
        }
    }
};
