import pkg from 'api-qasim';
const QasimAny = pkg;
import axios from 'axios';
export default {
    command: 'apkdl',
    aliases: ['apk', 'an1apk', 'appdl', 'app'],
    category: 'download',
    description: 'Search APKs and download by reply',
    usage: '.apkdl <apk_name>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const query = args.join(' ').trim();
        try {
            if (!query) {
                return await sock.sendMessage(chatId, { text: `*${t('p.apkdl.noQuery')}*\nExample: .apkdl Telegram` }, { quoted: message });
            }
            await sock.sendMessage(chatId, { text: `🔎 ${t('p.apkdl.searching')}` }, { quoted: message });
            const res = await QasimAny.apksearch(query);
            if (!res?.data || !Array.isArray(res.data) || res.data.length === 0) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.apkdl.noResults')}` }, { quoted: message });
            }
            const results = res.data;
            const first = results[0];
            let caption = `📱 *${t('p.apkdl.resultsFor', { query })}*\n\n`;
            caption += `↩️ *${t('p.apkdl.replyToDownload')}*\n\n`;
            results.forEach((item, i) => {
                caption +=
                    `*${i + 1}.* ${item.judul}\n` +
                        `👨‍💻 ${t('p.apkdl.developer')}: ${item.dev}\n` +
                        `⭐ ${t('p.apkdl.rating')}: ${item.rating}\n` +
                        `🔗 ${item.link}\n\n`;
            });
            const sentMsg = await sock.sendMessage(chatId, { image: { url: first.thumb }, caption }, { quoted: message });
            const timeout = setTimeout(async () => {
                sock.ev.off('messages.upsert', listener);
                await sock.sendMessage(chatId, { text: `⏱ ${t('p.apkdl.selectionExpired')}` }, { quoted: sentMsg });
            }, 5 * 60 * 1000);
            const listener = async ({ messages }) => {
                const m = messages[0];
                if (!m?.message || m.key.remoteJid !== chatId)
                    return;
                const ctx = m.message?.extendedTextMessage?.contextInfo;
                if (!ctx?.stanzaId || ctx.stanzaId !== sentMsg.key.id)
                    return;
                const replyText = m.message.conversation ||
                    m.message.extendedTextMessage?.text ||
                    '';
                const choice = parseInt(replyText.trim(), 10);
                if (isNaN(choice) || choice < 1 || choice > results.length) {
                    return await sock.sendMessage(chatId, { text: `❌ ${t('p.apkdl.invalidChoice', { max: results.length })}` }, { quoted: m });
                }
                clearTimeout(timeout);
                sock.ev.off('messages.upsert', listener);
                const selected = results[choice - 1];
                await sock.sendMessage(chatId, { text: `⬇️ ${t('p.apkdl.downloading', { name: selected.judul })}` }, { quoted: m });
                const apiUrl = `https://discardapi.dpdns.org/api/apk/dl/android1?apikey=guru&url=${
                    encodeURIComponent(selected.link)}`;
                const dlRes = await axios.get(apiUrl);
                const apk = dlRes.data?.result;
                if (!apk?.url) {
                    return await sock.sendMessage(chatId, { text: `❌ ${t('p.apkdl.noDownloadLink')}` }, { quoted: m });
                }
                const safeName = apk.name.replace(/[^\w.-]/g, '_');
                const apkCaption = `📦 *${t('p.apkdl.apkDownloaded')}*\n\n` +
                    `📛 ${t('p.apkdl.name')}: ${apk.name}\n` +
                    `⭐ ${t('p.apkdl.rating')}: ${apk.rating}\n` +
                    `📦 ${t('p.apkdl.size')}: ${apk.size}\n` +
                    `📱 ${t('p.apkdl.android')}: ${apk.requirement}\n` +
                    `🧒 ${t('p.apkdl.age')}: ${apk.rated}\n` +
                    `📅 ${t('p.apkdl.published')}: ${apk.published}\n\n` +
                    `📝 ${t('p.apkdl.description')}:\n${apk.description}`;
                await sock.sendMessage(chatId, { document: { url: apk.url }, fileName: `${safeName}.apk`, mimetype: 'application/vnd.android.package-archive', caption: apkCaption }, { quoted: m });
            };
            sock.ev.on('messages.upsert', listener);
        }
        catch (err) {
            console.error('❌ Android Plugin Error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.apkdl.processFailed')}` }, { quoted: message });
        }
    }
};
