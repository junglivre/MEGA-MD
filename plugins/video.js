import yts from 'yt-search';
import fs from 'fs';
import { downloadVideo, getVideoMetadata, getAvailableQualities, VIDEO_QUALITY_TIERS } from '../lib/ytdlp.js';
import { formatYtDlpError } from '../lib/ytdlpCore.js';
import { createTranslator, getUserLanguage } from '../lib/i18n.js';

const QUALITY_RE = new RegExp(`^(${VIDEO_QUALITY_TIERS.join('|')})p?$`, 'i');
const CUSTOM_FLAG_RE = /^--?custom$/i;
const PENDING_TTL_MS = 3 * 60 * 1000;

// `.video -custom <link>` asks which quality to use in a separate message
// instead of downloading right away. State is per chat+sender so a reply
// elsewhere, or by someone else, doesn't get mistaken for the answer.
const pendingCustom = new Map();

function pendingKey(chatId, senderId) {
    return `${chatId}:${senderId}`;
}

async function resolveVideo(sock, message, chatId, t, query) {
    let videoUrl;
    if (query.startsWith('http://') || query.startsWith('https://')) {
        videoUrl = query;
    }
    else {
        const { videos } = await yts(query);
        if (!videos?.length) {
            await sock.sendMessage(chatId, { text: `❌ ${t('p.video.noResults')}` }, { quoted: message });
            return null;
        }
        videoUrl = videos[0].url;
    }
    const validYT = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
    if (!validYT) {
        await sock.sendMessage(chatId, { text: `❌ ${t('p.video.invalidLink')}` }, { quoted: message });
        return null;
    }
    const ytId = validYT[1];
    let meta = {};
    try {
        meta = await getVideoMetadata(videoUrl, { sock });
    }
    catch { /* metadata lookup failed (private/restricted); fall back to the query/link below */ }
    const title = meta.title || query;
    const thumb = meta.thumbnail || `https://i.ytimg.com/vi/${ytId}/sddefault.jpg`;
    return { videoUrl, meta, title, thumb };
}

async function downloadAndSend(sock, message, chatId, t, video, maxHeight) {
    const { videoUrl, meta, title, thumb } = video;
    let result;
    try {
        const infoLines = [`🎬 *${title}*`];
        if (meta.uploader)
            infoLines.push(`📺 ${meta.uploader}`);
        if (meta.uploadDate)
            infoLines.push(`📅 ${meta.uploadDate}`);
        infoLines.push('', videoUrl, `⬇️ ${t('p.video.downloading')}`);
        const statusMsg = await sock.sendMessage(chatId, {
            image: { url: thumb },
            caption: infoLines.join('\n')
        }, { quoted: message });
        result = await downloadVideo(videoUrl, { sock, ...(maxHeight ? { maxHeight } : {}) });
        const videoBuffer = await fs.promises.readFile(result.filePath);
        const finalTitle = result.title || title;
        const finalCaptionLines = [`🎬 *${finalTitle}*`];
        if (meta.uploader)
            finalCaptionLines.push(`📺 ${meta.uploader}`);
        if (meta.uploadDate)
            finalCaptionLines.push(`📅 ${meta.uploadDate}`);
        finalCaptionLines.push('', videoUrl, '', `> *_${t('p.video.footer')}_*`);
        await sock.sendMessage(chatId, {
            video: videoBuffer,
            mimetype: 'video/mp4',
            fileName: `${finalTitle}.mp4`,
            caption: finalCaptionLines.join('\n')
        }, { quoted: message });
        await sock.sendMessage(chatId, { delete: statusMsg.key });
    }
    catch (err) {
        console.error('[VIDEO] Error:', err.message);
        await sock.sendMessage(chatId, { text: `❌ ${t('p.video.failed', { reason: formatYtDlpError(err, t) })}` }, { quoted: message });
    }
    finally {
        if (result)
            await result.cleanup();
    }
}

// Called from lib/messageHandler.js for every plain-text message, before the
// prefix/command lookup — cheap no-op (one Map.get) when nobody has a
// pending `.video -custom` request. Returns true when it consumed the
// message so the caller stops further processing (command dispatch, other
// game-reply handlers, etc).
export async function handleVideoQualityReply(sock, chatId, senderId, text, message) {
    const key = pendingKey(chatId, senderId);
    const pending = pendingCustom.get(key);
    if (!pending)
        return false;
    const trimmed = text.trim();
    if (!/^\d+$/.test(trimmed))
        return false;
    const num = Number(trimmed);
    let chosenHeight;
    if (pending.qualities.includes(num))
        chosenHeight = num;
    else if (num >= 1 && num <= pending.qualities.length)
        chosenHeight = pending.qualities[num - 1];
    if (!chosenHeight)
        return false;
    clearTimeout(pending.timer);
    pendingCustom.delete(key);
    const t = createTranslator(await getUserLanguage(senderId));
    await downloadAndSend(sock, message, chatId, t, pending.video, chosenHeight);
    return true;
}

export default {
    command: 'video',
    aliases: ['ytmp4', 'ytvideo', 'ytdl'],
    category: 'download',
    description: 'Download YouTube videos by link or search',
    usage: '.video <youtube link | search query> [quality: 1080|720|480|360|240|144] | .video -custom <link>',
    async handler(sock, message, args, context) {
        const { t, senderId } = context;
        const chatId = context.chatId || message.key.remoteJid;
        const argsList = args.filter((a) => !CUSTOM_FLAG_RE.test(a));
        const isCustom = argsList.length !== args.length;
        let maxHeight;
        if (argsList.length > 1 && QUALITY_RE.test(argsList[argsList.length - 1])) {
            const parsed = Number(argsList.pop().replace(/p$/i, ''));
            if (!isCustom)
                maxHeight = parsed;
        }
        const query = argsList.join(' ').trim();
        if (!query)
            return sock.sendMessage(chatId, { text: `🎥 ${t('p.video.askQuery')}` }, { quoted: message });
        let video;
        try {
            video = await resolveVideo(sock, message, chatId, t, query);
        }
        catch (err) {
            console.error('[VIDEO] Error:', err.message);
            return sock.sendMessage(chatId, { text: `❌ ${t('p.video.failed', { reason: formatYtDlpError(err, t) })}` }, { quoted: message });
        }
        if (!video)
            return;
        if (!isCustom)
            return downloadAndSend(sock, message, chatId, t, video, maxHeight);
        let qualities = [];
        try {
            qualities = await getAvailableQualities(video.videoUrl, { sock });
        }
        catch { /* listing failed; fall back to the default download below */ }
        if (!qualities.length) {
            await sock.sendMessage(chatId, { text: `ℹ️ ${t('p.video.customFallback')}` }, { quoted: message });
            return downloadAndSend(sock, message, chatId, t, video, maxHeight);
        }
        const key = pendingKey(chatId, senderId);
        const existing = pendingCustom.get(key);
        if (existing)
            clearTimeout(existing.timer);
        const timer = setTimeout(async () => {
            pendingCustom.delete(key);
            await sock.sendMessage(chatId, { text: `⏱️ ${t('p.video.customExpired')}` }, { quoted: message }).catch(() => {});
        }, PENDING_TTL_MS);
        pendingCustom.set(key, { video, qualities, timer });
        const list = qualities.map((h, i) => `${i + 1}️⃣ ${h}p`).join('\n');
        await sock.sendMessage(chatId, {
            text: `🎚️ *${t('p.video.customIntro', { title: video.title })}*\n\n${list}\n\n${t('p.video.customPrompt')}`
        }, { quoted: message });
    }
};
