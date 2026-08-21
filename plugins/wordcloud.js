import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
const execAsync = promisify(exec);
const WA_LIMIT = 60000;
function getQuoted(message) {
    return message?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
}
async function sendResult(sock, chatId, channelInfo, message, text, filename, t) {
    if (text.length > WA_LIMIT) {
        const tmpFile = path.join(process.cwd(), 'temp', filename);
        fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
        fs.writeFileSync(tmpFile, text);
        await sock.sendMessage(chatId, {
            document: fs.readFileSync(tmpFile),
            mimetype: 'text/plain',
            fileName: filename,
            caption: `📝 ${t('p.wordcloud.tooLarge')}`,
            ...channelInfo
        }, { quoted: message });
        try {
            fs.unlinkSync(tmpFile);
        }
        catch { }
    }
    else {
        await sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });
    }
}
export default {
    command: 'wordcloud',
    aliases: ['wordfreq', 'topwords', 'wordcount'],
    category: 'utility',
    description: 'Analyze text and show top 20 most used words with stats',
    usage: '.wordcloud <text or reply to any message/file>',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        const scriptPath = path.join(process.cwd(), 'lib', 'wordcloud.py');
        if (!fs.existsSync(scriptPath)) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.wordcloud.scriptMissing')}`,
                ...channelInfo
            }, { quoted: message });
        }
        const quoted = getQuoted(message);
        const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
        const hasDoc = !!quoted?.documentMessage;
        const textInput = args.join(' ').trim() || quotedText;
        if (!textInput && !hasDoc) {
            return await sock.sendMessage(chatId, {
                text: `📝 *${t('p.wordcloud.usageTitle')}*\n\n${t('p.wordcloud.usageBody')}`,
                ...channelInfo
            }, { quoted: message });
        }
        await sock.sendMessage(chatId, { text: `🔍 ${t('p.wordcloud.analyzing')}`, ...channelInfo }, { quoted: message });
        const tempDir = path.join(process.cwd(), 'temp');
        fs.mkdirSync(tempDir, { recursive: true });
        const id = Date.now();
        try {
            let cmd;
            if (hasDoc && quoted) {
                // Download document
                const msgObj = { message: { documentMessage: quoted.documentMessage } };
                const buf = await downloadMediaMessage(msgObj, 'buffer', {});
                const tmpFile = path.join(tempDir, `wc_in_${id}.txt`);
                fs.writeFileSync(tmpFile, buf);
                cmd = `python3 "${scriptPath}" --file "${tmpFile}"`;
                const { stdout } = await execAsync(cmd, { timeout: 30000 });
                try {
                    fs.unlinkSync(tmpFile);
                }
                catch { }
                const data = JSON.parse(stdout.trim());
                if (data.error) {
                    return await sock.sendMessage(chatId, { text: `❌ ${data.error}`, ...channelInfo }, { quoted: message });
                }
                await sendResult(sock, chatId, channelInfo, message, formatResult(data, t), `wordcloud_${id}.txt`, t);
            }
            else {
                const tmpFile = path.join(tempDir, `wc_in_${id}.txt`);
                fs.writeFileSync(tmpFile, textInput);
                cmd = `python3 "${scriptPath}" --file "${tmpFile}"`;
                const { stdout } = await execAsync(cmd, { timeout: 30000 });
                try {
                    fs.unlinkSync(tmpFile);
                }
                catch { }
                const data = JSON.parse(stdout.trim());
                if (data.error) {
                    return await sock.sendMessage(chatId, { text: `❌ ${data.error}`, ...channelInfo }, { quoted: message });
                }
                await sendResult(sock, chatId, channelInfo, message, formatResult(data, t), `wordcloud_${id}.txt`, t);
            }
        }
        catch (error) {
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.wordcloud.analysisFailed', { message: error.message })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
function formatResult(d, t) {
    const bar = (count, max) => {
        const filled = Math.round((count / max) * 10);
        return '█'.repeat(filled) + '░'.repeat(10 - filled);
    };
    const maxCount = d.top_words?.[0]?.count || 1;
    let topWordsText = '';
    if (d.top_words?.length) {
        topWordsText = d.top_words.map((w, i) => `${String(i + 1).padStart(2, ' ')}. ${w.word.padEnd(15)} ${bar(w.count, maxCount)} ${w.count}x`).join('\n');
    }
    return `📝 *${t('p.wordcloud.resultTitle')}*\n\n` +
        `━━━━━━ 📊 ${t('p.wordcloud.statsHeader')} ━━━━━━\n` +
        `📖 *${t('p.wordcloud.totalWords')}:* ${d.total_words?.toLocaleString()}\n` +
        `🔤 *${t('p.wordcloud.uniqueWords')}:* ${d.unique_words?.toLocaleString()}\n` +
        `📝 *${t('p.wordcloud.characters')}:* ${d.total_chars?.toLocaleString()}\n` +
        `📜 *${t('p.wordcloud.sentences')}:* ${d.sentences}\n` +
        `📄 *${t('p.wordcloud.paragraphs')}:* ${d.paragraphs}\n` +
        `⏱️ *${t('p.wordcloud.readingTime')}:* ${d.reading_time}\n` +
        `🎯 *${t('p.wordcloud.lexicalDiversity')}:* ${d.lexical_diversity}%\n` +
        `📏 *${t('p.wordcloud.avgWordLength')}:* ${d.avg_word_len} ${t('p.wordcloud.charsUnit')}\n\n` +
        `━━━━━━ 🏆 ${t('p.wordcloud.topWordsHeader')} ━━━━━━\n` +
        `\`\`\`\n${topWordsText}\n\`\`\``;
}
