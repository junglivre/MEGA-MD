import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
const execAsync = promisify(exec);
function getQuoted(message) {
    return message?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
}
function getMediaType(quoted) {
    if (quoted?.imageMessage)
        return 'image';
    if (quoted?.videoMessage)
        return 'video';
    if (quoted?.audioMessage)
        return 'audio';
    if (quoted?.documentMessage)
        return 'document';
    if (quoted?.stickerMessage)
        return 'sticker';
    return null;
}
export default {
    command: 'dna',
    aliases: ['dnaencode', 'dnadecode'],
    category: 'utility',
    description: 'Encode any text or media to DNA sequence (ATCG) or decode it back',
    usage: '.dna encode <text or reply to media>\n.dna decode <DNA or reply to DNA file>',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        const quoted = getQuoted(message);
        const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
        const mediaType = getMediaType(quoted);
        if (!args.length) {
            return await sock.sendMessage(chatId, {
                text: `🧬 *${t('p.dna.title')}*\n\n` +
                    `*${t('p.dna.textLabel')}*\n` +
                    `\`.dna encode Hello World\`\n` +
                    `\`.dna decode ATCGATCG...\`\n\n` +
                    `*${t('p.dna.mediaLabel')}*\n` +
                    `\`.dna encode\` — ${t('p.dna.encodeMediaDesc')}\n` +
                    `\`.dna decode\` — ${t('p.dna.decodeMediaDesc')}\n\n` +
                    `ℹ️ ${t('p.dna.info')}`,
                ...channelInfo
            }, { quoted: message });
        }
        const mode = args[0]?.toLowerCase();
        if (mode !== 'encode' && mode !== 'decode') {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.dna.invalidMode')}`,
                ...channelInfo
            }, { quoted: message });
        }
        // Check binary exists
        const binPath = path.join(process.cwd(), 'lib', 'bin', 'dna');
        if (!fs.existsSync(binPath)) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.dna.binaryMissing')}`,
                ...channelInfo
            }, { quoted: message });
        }
        const tempDir = path.join(process.cwd(), 'temp');
        fs.mkdirSync(tempDir, { recursive: true });
        const id = Date.now();
        try {
            if (mode === 'encode') {
                let inputBuffer;
                let sourceLabel;
                if (mediaType && quoted) {
                    // Download media
                    await sock.sendMessage(chatId, { text: `⏳ ${t('p.dna.downloading')}`, ...channelInfo }, { quoted: message });
                    const msgObj = { message: { [`${mediaType}Message`]: quoted[`${mediaType}Message`] } };
                    inputBuffer = await downloadMediaMessage(msgObj, 'buffer', {});
                    sourceLabel = `${mediaType} file (${inputBuffer.length} bytes)`;
                }
                else {
                    // Text input
                    const textInput = args.slice(1).join(' ').trim() || quotedText;
                    if (!textInput) {
                        return await sock.sendMessage(chatId, {
                            text: `❌ ${t('p.dna.noInputEncode')}`,
                            ...channelInfo
                        }, { quoted: message });
                    }
                    inputBuffer = Buffer.from(textInput, 'utf8');
                    sourceLabel = `text (${inputBuffer.length} bytes)`;
                }
                // Write input to temp file
                const inFile = path.join(tempDir, `dna_in_${id}.bin`);
                const outFile = path.join(tempDir, `dna_out_${id}.txt`);
                fs.writeFileSync(inFile, inputBuffer);
                await sock.sendMessage(chatId, { text: `🧬 ${t('p.dna.encoding')}`, ...channelInfo }, { quoted: message });
                // Encode the base64 of the file
                const b64 = inputBuffer.toString('base64');
                const b64File = path.join(tempDir, `dna_b64_${id}.txt`);
                fs.writeFileSync(b64File, b64);
                const result = await execAsync(`"${binPath}" encode "${b64}"`, { timeout: 30000, maxBuffer: 50 * 1024 * 1024 });
                const dnaResult = result.stdout.trim();
                fs.writeFileSync(outFile, dnaResult);
                await sock.sendMessage(chatId, {
                    document: fs.readFileSync(outFile),
                    mimetype: 'text/plain',
                    fileName: `dna_encoded_${id}.txt`,
                    caption: `🧬 *${t('p.dna.encodedTitle')}*\n\n` +
                        `📥 *${t('p.dna.sourceLabel')}* ${sourceLabel}\n` +
                        `📤 *${t('p.dna.dnaBasesLabel')}* ${dnaResult.length.toLocaleString()}\n\n` +
                        `_${t('p.dna.replyToRestore')}_`,
                    ...channelInfo
                }, { quoted: message });
                // Cleanup
                for (const f of [inFile, outFile, b64File])
                    try {
                        fs.unlinkSync(f);
                    }
                    catch { }
            }
            else {
                // DECODE
                let dnaInput;
                if (quoted?.documentMessage) {
                    // Download DNA file
                    await sock.sendMessage(chatId, { text: `⏳ ${t('p.dna.readingFile')}`, ...channelInfo }, { quoted: message });
                    const msgObj = { message: { documentMessage: quoted.documentMessage } };
                    const buf = await downloadMediaMessage(msgObj, 'buffer', {});
                    dnaInput = buf.toString('utf8').trim();
                }
                else {
                    dnaInput = args.slice(1).join(' ').trim() || quotedText;
                }
                if (!dnaInput) {
                    return await sock.sendMessage(chatId, {
                        text: `❌ ${t('p.dna.noInputDecode')}`,
                        ...channelInfo
                    }, { quoted: message });
                }
                if (!/^[ATCGatcg\s]+$/.test(dnaInput)) {
                    return await sock.sendMessage(chatId, {
                        text: `❌ ${t('p.dna.invalidSequence')}`,
                        ...channelInfo
                    }, { quoted: message });
                }
                const cleanDna = dnaInput.replace(/\s/g, '');
                await sock.sendMessage(chatId, { text: `🔬 ${t('p.dna.decoding')}`, ...channelInfo }, { quoted: message });
                const { stdout, stderr } = await execAsync(`"${binPath}" decode "${cleanDna}"`, { timeout: 30000, maxBuffer: 50 * 1024 * 1024 });
                if (stderr && !stdout) {
                    return await sock.sendMessage(chatId, { text: `❌ ${stderr.trim()}`, ...channelInfo }, { quoted: message });
                }
                const decoded = stdout.trim();
                // Try to detect if it was originally base64 encoded media
                const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(decoded) && decoded.length % 4 === 0;
                if (isBase64 && decoded.length > 100) {
                    // It was a file — restore it
                    const fileBuffer = Buffer.from(decoded, 'base64');
                    const outFile = path.join(tempDir, `dna_decoded_${id}.bin`);
                    fs.writeFileSync(outFile, fileBuffer);
                    await sock.sendMessage(chatId, {
                        document: fileBuffer,
                        mimetype: 'application/octet-stream',
                        fileName: `dna_decoded_${id}`,
                        caption: `🧬 *${t('p.dna.decodedTitle')}*\n\n` +
                            `📦 *${t('p.dna.restoredFileLabel')}* ${fileBuffer.length.toLocaleString()} ${t('p.dna.bytesUnit')}`,
                        ...channelInfo
                    }, { quoted: message });
                    try {
                        fs.unlinkSync(outFile);
                    }
                    catch { }
                }
                else {
                    // Plain text result
                    if (decoded.length > 800) {
                        const outFile = path.join(tempDir, `dna_decoded_${id}.txt`);
                        fs.writeFileSync(outFile, decoded);
                        await sock.sendMessage(chatId, {
                            document: fs.readFileSync(outFile),
                            mimetype: 'text/plain',
                            fileName: `dna_decoded_${id}.txt`,
                            caption: `🧬 *${t('p.dna.decodedTitle')}* — ${decoded.length} ${t('p.dna.charsUnit')}`,
                            ...channelInfo
                        }, { quoted: message });
                        try {
                            fs.unlinkSync(outFile);
                        }
                        catch { }
                    }
                    else {
                        await sock.sendMessage(chatId, {
                            text: `🧬 *${t('p.dna.decodedTitle')}*\n\n` +
                                `📤 *${t('p.dna.resultLabel')}*\n\`\`\`\n${decoded}\n\`\`\``,
                            ...channelInfo
                        }, { quoted: message });
                    }
                }
            }
        }
        catch (error) {
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.dna.failed', { error: error.message })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
