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
            caption: `🌐 ${t('p.urldecode.tooLarge')}`,
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
    command: 'urldecode',
    aliases: ['urlencode', 'urlextract', 'links', 'extractlinks'],
    category: 'utility',
    description: 'Encode/decode URLs or extract all links from text/files',
    usage: '.urldecode <url>\n.urlencode <text>\n.extractlinks <text or reply to file>',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, userMessage, t } = context;
        const scriptPath = path.join(process.cwd(), 'lib', 'urltool.py');
        if (!fs.existsSync(scriptPath)) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.urldecode.scriptMissing')}`,
                ...channelInfo
            }, { quoted: message });
        }
        const quoted = getQuoted(message);
        const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
        const hasDoc = !!quoted?.documentMessage;
        // Detect mode from command used
        let mode = 'decode';
        if (userMessage.startsWith('urlencode') || userMessage.startsWith('/urlencode') ||
            userMessage.startsWith('.urlencode') || userMessage.startsWith('!urlencode')) {
            mode = 'encode';
        }
        else if (userMessage.startsWith('extractlinks') || userMessage.startsWith('/extractlinks') ||
            userMessage.startsWith('.extractlinks') || userMessage.startsWith('!extractlinks') ||
            userMessage.startsWith('links')) {
            mode = 'extract';
        }
        else if (args[0]?.toLowerCase() === 'encode') {
            mode = 'encode';
            args = args.slice(1);
        }
        else if (args[0]?.toLowerCase() === 'extract' || args[0]?.toLowerCase() === 'links') {
            mode = 'extract';
            args = args.slice(1);
        }
        else if (args[0]?.toLowerCase() === 'decode') {
            mode = 'decode';
            args = args.slice(1);
        }
        const textInput = args.join(' ').trim() || quotedText;
        if (!textInput && !hasDoc) {
            return await sock.sendMessage(chatId, {
                text: t('p.urldecode.help'),
                ...channelInfo
            }, { quoted: message });
        }
        const tempDir = path.join(process.cwd(), 'temp');
        fs.mkdirSync(tempDir, { recursive: true });
        const id = Date.now();
        try {
            let stdout;
            if (hasDoc && quoted && mode === 'extract') {
                // Download and extract from file
                await sock.sendMessage(chatId, { text: `⏳ ${t('p.urldecode.readingFile')}`, ...channelInfo }, { quoted: message });
                const msgObj = { message: { documentMessage: quoted.documentMessage } };
                const buf = await downloadMediaMessage(msgObj, 'buffer', {});
                const tmpFile = path.join(tempDir, `url_in_${id}.txt`);
                fs.writeFileSync(tmpFile, buf);
                const result = await execAsync(`python3 "${scriptPath}" extract --file "${tmpFile}"`, { timeout: 30000 });
                stdout = result.stdout;
                try {
                    fs.unlinkSync(tmpFile);
                }
                catch { }
            }
            else {
                const safeText = textInput.replace(/'/g, "'\"'\"'");
                const result = await execAsync(`python3 "${scriptPath}" ${mode} '${safeText}'`, { timeout: 30000 });
                stdout = result.stdout;
            }
            const data = JSON.parse(stdout.trim());
            if (data.error) {
                return await sock.sendMessage(chatId, { text: `❌ ${data.error}`, ...channelInfo }, { quoted: message });
            }
            let resultText = '';
            if (mode === 'decode') {
                resultText = `🌐 *${t('p.urldecode.decoderTitle')}*\n\n` +
                    `📥 *${t('p.urldecode.original')}:*\n\`${data.original}\`\n\n` +
                    `📤 *${t('p.urldecode.decoded')}:*\n\`${data.decoded}\``;
                if (data.scheme)
                    resultText += `\n\n🔍 *${t('p.urldecode.breakdown')}:*\n• ${t('p.urldecode.scheme')}: ${data.scheme}\n• ${t('p.urldecode.host')}: ${data.host}\n• ${t('p.urldecode.path')}: ${data.path}`;
                if (data.query_params) {
                    const params = Object.entries(data.query_params).map(([k, v]) => `  • ${k}: ${v}`).join('\n');
                    resultText += `\n• ${t('p.urldecode.params')}:\n${params}`;
                }
                if (data.fragment)
                    resultText += `\n• ${t('p.urldecode.fragment')}: ${data.fragment}`;
            }
            else if (mode === 'encode') {
                resultText = `🌐 *${t('p.urldecode.encoderTitle')}*\n\n` +
                    `📥 *${t('p.urldecode.original')}:*\n\`${data.original}\`\n\n` +
                    `🔒 *${t('p.urldecode.fullyEncoded')}:*\n\`${data.fully_encoded}\`\n\n` +
                    `🔓 *${t('p.urldecode.safeEncoded')}:*\n\`${data.safe_encoded}\``;
            }
            else {
                // Extract
                if (data.total === 0) {
                    resultText = `🌐 *${t('p.urldecode.extractorTitle')}*\n\n❌ ${t('p.urldecode.noLinksFound')}`;
                }
                else {
                    const lines = [`🌐 *${t('p.urldecode.extractorTitle')} — ${t('p.urldecode.linksFound', { total: data.total })}*\n`];
                    if (data.social?.length) {
                        lines.push(`📱 *${t('p.urldecode.socialMedia', { count: data.social.length })}:*`);
                        data.social.forEach((u) => lines.push(`• ${u}`));
                        lines.push('');
                    }
                    if (data.media?.length) {
                        lines.push(`🖼️ *${t('p.urldecode.mediaFiles', { count: data.media.length })}:*`);
                        data.media.forEach((u) => lines.push(`• ${u}`));
                        lines.push('');
                    }
                    if (data.documents?.length) {
                        lines.push(`📄 *${t('p.urldecode.documents', { count: data.documents.length })}:*`);
                        data.documents.forEach((u) => lines.push(`• ${u}`));
                        lines.push('');
                    }
                    if (data.other?.length) {
                        lines.push(`🔗 *${t('p.urldecode.otherLinks', { count: data.other.length })}:*`);
                        data.other.forEach((u) => lines.push(`• ${u}`));
                    }
                    resultText = lines.join('\n');
                }
            }
            await sendResult(sock, chatId, channelInfo, message, resultText, `urls_${id}.txt`, t);
        }
        catch (error) {
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.urldecode.failed', { error: error.message })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
