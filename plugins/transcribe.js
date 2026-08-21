import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { groqTranscribe, hasGroqKey } from '../lib/groq.js';

function getAudioMessage(message) {
    const current = message.message || {};
    const quoted = current.extendedTextMessage?.contextInfo?.quotedMessage || {};
    return current.audioMessage || quoted.audioMessage || null;
}

async function toBuffer(media) {
    const stream = await downloadContentFromMessage(media, 'audio');
    const chunks = [];
    for await (const chunk of stream)
        chunks.push(chunk);
    return Buffer.concat(chunks);
}

export default {
    command: 'transcrever',
    aliases: ['transcribe', 'transcription', 'stt'],
    category: 'tools',
    description: 'Transcribe a voice message or audio with Groq Whisper',
    usage: '.transcrever (reply to an audio message)',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        if (!hasGroqKey()) {
            return sock.sendMessage(chatId, {
                text: `❌ ${t('p.transcribe.noKey')}`,
                ...channelInfo
            }, { quoted: message });
        }
        const audio = getAudioMessage(message);
        if (!audio) {
            return sock.sendMessage(chatId, {
                text: `🎙️ ${t('p.transcribe.noAudio')}`,
                ...channelInfo
            }, { quoted: message });
        }
        try {
            await sock.sendMessage(chatId, { text: `🎙️ ${t('p.transcribe.processing')}`, ...channelInfo }, { quoted: message });
            const buffer = await toBuffer(audio);
            const language = args[0]?.match(/^[a-z]{2}$/i)?.[0]?.toLowerCase();
            const text = await groqTranscribe(buffer, 'audio.ogg', audio.mimetype || 'audio/ogg', { language });
            if (!text)
                throw new Error('Groq returned an empty transcription');
            await sock.sendMessage(chatId, { text: `📝 *${t('p.transcribe.resultTitle')}:*\n\n${text}`, ...channelInfo }, { quoted: message });
        }
        catch (error) {
            console.error('[TRANSCRIBE] Error:', error.message);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.transcribe.failed', { error: error.message })}`, ...channelInfo }, { quoted: message });
        }
    }
};
