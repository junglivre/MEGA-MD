import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getBin } from '../lib/compile.js';
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
            caption: `📈 ${t('p.analyze.resultTooLarge')}`,
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
    command: 'analyze',
    aliases: ['textanalyze', 'textanalyser', 'analyse', 'readability'],
    category: 'utility',
    description: 'Deep text analysis: reading level, sentiment, word stats (C++ powered)',
    usage: '.analyze <text or reply to any message/file>',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        const binPath = getBin('analyze');
        if (!fs.existsSync(binPath)) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.analyze.binaryUnavailable')}`,
                ...channelInfo
            }, { quoted: message });
        }
        const quoted = getQuoted(message);
        const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
        const hasDoc = !!quoted?.documentMessage;
        const textInput = args.join(' ').trim() || quotedText;
        if (!textInput && !hasDoc) {
            return await sock.sendMessage(chatId, {
                text: `📈 *${t('p.analyze.title')}*\n\n` +
                    `*${t('p.analyze.usageLabel')}:* \`.analyze <paste any text>\`\n\n` +
                    `*${t('p.analyze.orReplyTo')}:*\n` +
                    `• ${t('p.analyze.anyTextMessage')}\n` +
                    `• ${t('p.analyze.docFile')}\n\n` +
                    `*${t('p.analyze.outputIncludes')}:*\n` +
                    `📊 ${t('p.analyze.outCounts')}\n` +
                    `📖 ${t('p.analyze.outFlesch')}\n` +
                    `😊 ${t('p.analyze.outSentiment')}\n` +
                    `⏱️ ${t('p.analyze.outReadingTime')}\n` +
                    `🏆 ${t('p.analyze.outKeywords')}`,
                ...channelInfo
            }, { quoted: message });
        }
        await sock.sendMessage(chatId, { text: `🔍 ${t('p.analyze.analyzing')}`, ...channelInfo }, { quoted: message });
        const tempDir = path.join(process.cwd(), 'temp');
        fs.mkdirSync(tempDir, { recursive: true });
        const id = Date.now();
        try {
            let stdout;
            if (hasDoc && quoted) {
                const msgObj = { message: { documentMessage: quoted.documentMessage } };
                const buf = await downloadMediaMessage(msgObj, 'buffer', {});
                const tmpFile = path.join(tempDir, `analyze_in_${id}.txt`);
                fs.writeFileSync(tmpFile, buf);
                const result = await execAsync(`"${binPath}" --file "${tmpFile}"`, { timeout: 30000 });
                stdout = result.stdout;
                try {
                    fs.unlinkSync(tmpFile);
                }
                catch { }
            }
            else {
                const tmpFile = path.join(tempDir, `analyze_in_${id}.txt`);
                fs.writeFileSync(tmpFile, textInput);
                const result = await execAsync(`"${binPath}" --file "${tmpFile}"`, { timeout: 30000 });
                stdout = result.stdout;
                try {
                    fs.unlinkSync(tmpFile);
                }
                catch { }
            }
            const data = JSON.parse(stdout.trim());
            const bar = (score) => {
                const filled = Math.round(score / 10);
                return '█'.repeat(filled) + '░'.repeat(10 - filled);
            };
            const fleschBar = bar(data.flesch_score / 10);
            const sentBar = data.sentiment_score >= 0
                ? '🟢'.repeat(Math.min(5, Math.round(data.sentiment_score / 20)))
                : '🔴'.repeat(Math.min(5, Math.round(Math.abs(data.sentiment_score) / 20)));
            const topWordsText = data.top_words?.length
                ? data.top_words.slice(0, 15).map((w, i) => `${String(i + 1).padStart(2)}. ${w.word.padEnd(15)} ${w.count}x`).join('\n')
                : 'N/A';
            const resultText = `📈 *${t('p.analyze.reportTitle')}*\n\n` +
                `━━━━━━ 📊 ${t('p.analyze.countsSection')} ━━━━━━\n` +
                `📖 *${t('p.analyze.words')}:* ${data.total_words?.toLocaleString()} (${data.unique_words?.toLocaleString()} ${t('p.analyze.unique')})\n` +
                `📝 *${t('p.analyze.characters')}:* ${data.total_chars?.toLocaleString()} (${data.chars_no_spaces?.toLocaleString()} ${t('p.analyze.noSpaces')})\n` +
                `📜 *${t('p.analyze.sentences')}:* ${data.sentences}\n` +
                `📄 *${t('p.analyze.paragraphs')}:* ${data.paragraphs}\n` +
                `🔤 *${t('p.analyze.syllables')}:* ${data.syllables?.toLocaleString()}\n` +
                `📏 *${t('p.analyze.avgWordLength')}:* ${data.avg_word_length} ${t('p.analyze.chars')}\n` +
                `📐 *${t('p.analyze.avgSentenceLength')}:* ${data.avg_sentence_length} ${t('p.analyze.words2')}\n` +
                `🔠 *${t('p.analyze.complexWords')}:* ${data.long_words}\n\n` +
                `━━━━━━ 📖 ${t('p.analyze.readabilitySection')} ━━━━━━\n` +
                `📊 *${t('p.analyze.fleschScore')}:* ${data.flesch_score}/100\n` +
                `${fleschBar}\n` +
                `🎓 *${t('p.analyze.readingLevel')}:* ${data.reading_level}\n` +
                `⏱️ *${t('p.analyze.readingTime')}:* ${data.reading_time}\n\n` +
                `━━━━━━ 😊 ${t('p.analyze.sentimentSection')} ━━━━━━\n` +
                `${sentBar || '⬜⬜⬜⬜⬜'}\n` +
                `🎭 *${t('p.analyze.overall')}:* ${data.sentiment}\n` +
                `✅ *${t('p.analyze.positiveWords')}:* ${data.positive_words}\n` +
                `❌ *${t('p.analyze.negativeWords')}:* ${data.negative_words}\n\n` +
                `━━━━━━ 🏆 ${t('p.analyze.topKeywordsSection')} ━━━━━━\n` +
                `\`\`\`\n${topWordsText}\n\`\`\``;
            await sendResult(sock, chatId, channelInfo, message, resultText, `analysis_${id}.txt`, t);
        }
        catch (error) {
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.analyze.analysisFailed', { error: error.message })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
