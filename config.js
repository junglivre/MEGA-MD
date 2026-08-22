import 'dotenv/config';
const _prefixes = process.env.PREFIXES ? process.env.PREFIXES.split(',') : ['.', '!', '/', '#'];
const rawQuoteApiUrl = process.env.QUOTE_API_URL || process.env.QUOAPI_URL || 'https://quoapi.jung.moe/generate';
const quoteApiUrl = `${rawQuoteApiUrl.replace(/\/+$/, '')}${/\/generate$/i.test(rawQuoteApiUrl) ? '' : '/generate'}`;
const chatResponseSizes = new Set(['short', 'medium', 'big']);
const configuredChatSize = String(process.env.GROQ_CHAT_RESPONSE_SIZE || 'medium').trim().toLowerCase();
const groqChatResponseSize = chatResponseSizes.has(configuredChatSize) ? configuredChatSize : 'medium';
const defaultChatTokens = { short: 300, medium: 700, big: 1400 };
const visionResponseSizes = new Set(['small', 'medium', 'big']);
const configuredVisionSize = String(process.env.GROQ_VISION_REASONING || process.env.GROQ_VISION_RESPONSE_SIZE || 'medium').trim().toLowerCase();
const groqVisionResponseSize = visionResponseSizes.has(configuredVisionSize) ? configuredVisionSize : 'medium';
const defaultVisionTokens = { small: 300, medium: 600, big: 1000 };
const defaultVisionChars = { small: 1200, medium: 2400, big: 4800 };
const configuredChatTemperature = Number(process.env.GROQ_CHAT_TEMPERATURE);
const configuredPackName = process.env.PACK_OWNER || process.env.PACKNAME || 'MEGA-MD';
const config = {
    // Bot Identity
    botName: process.env.BOT_NAME || 'MEGA-MD',
    botOwner: process.env.OWNER || process.env.BOT_OWNER || 'Qasim Ali',
    ownerNumber: process.env.OWNER_NUMBER || '923051391007',
    ownerLid: process.env.OWNER_LID || '',
    author: process.env.AUTHOR || process.env.OWNER || process.env.BOT_OWNER || 'Qasim Ali',
    packOwner: configuredPackName,
    packname: configuredPackName,
    description: process.env.DESCRIPTION || 'High performance multi-device WhatsApp bot',
    version: '6.0.0',
    // Bot Config
    prefixes: _prefixes,
    prefix: _prefixes[0],
    commandMode: process.env.COMMAND_MODE || 'public',
    timeZone: process.env.TIMEZONE || 'Asia/Karachi',
    defaultLanguage: process.env.DEFAULT_LANGUAGE || 'pt-BR',
    newsletterJid: process.env.NEWSLETTER_JID || '',
    newsletterName: process.env.NEWSLETTER_NAME || '',
    newsletterServerMessageId: Number.isFinite(Number(process.env.NEWSLETTER_SERVER_MESSAGE_ID))
        ? Number(process.env.NEWSLETTER_SERVER_MESSAGE_ID)
        : -1,
    // Links
    channelLink: process.env.CHANNEL_LINK || 'https://whatsapp.com/channel/0029VagJIAr3bbVBCpEkAM07',
    updateZipUrl: process.env.UPDATE_URL || 'https://github.com/junglivre/MEGA-MD/archive/refs/heads/main.zip',
    ytChannel: process.env.YT_CHANNEL || 'GlobalTechInfo',
    // Session
    sessionId: process.env.SESSION_ID || '',
    pairingNumber: process.env.PAIRING_NUMBER || '',
    // Performance
    port: Number(process.env.PORT) || 5000,
    maxStoreMessages: Number(process.env.MAX_STORE_MESSAGES) || 100,
    tempCleanupInterval: Number(process.env.CLEANUP_INTERVAL) || 1 * 60 * 60 * 1000,
    storeWriteInterval: Number(process.env.STORE_WRITE_INTERVAL) || 10000,
    backupEnabled: process.env.BACKUP_ENABLED !== 'false',
    backupInterval: Number(process.env.BACKUP_INTERVAL) || 24 * 60 * 60 * 1000,
    backupRetention: Number(process.env.BACKUP_RETENTION) || 7,
    backupDirectory: process.env.BACKUP_DIR || 'backups',
    groqChatModel: process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b',
    groqVisionModel: process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b',
    groqVisionResponseSize,
    groqVisionMaxTokens: Math.max(100, Number(process.env.GROQ_VISION_MAX_TOKENS) || defaultVisionTokens[groqVisionResponseSize]),
    groqVisionMaxChars: Math.max(400, Number(process.env.GROQ_VISION_MAX_CHARS) || defaultVisionChars[groqVisionResponseSize]),
    groqTranscriptionModel: process.env.GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo',
    groqChatInstructions: process.env.GROQ_CHAT_INSTRUCTIONS || '',
    groqChatResponseSize,
    groqChatMaxTokens: Math.max(100, Number(process.env.GROQ_CHAT_MAX_TOKENS) || defaultChatTokens[groqChatResponseSize]),
    groqChatTemperature: Number.isFinite(configuredChatTemperature) ? Math.min(2, Math.max(0, configuredChatTemperature)) : 0.7,
    groqChatHistoryLimit: Math.max(1, Number(process.env.GROQ_CHAT_HISTORY_LIMIT) || 20),
    quoteApiUrl,
    lastFmApiKey: process.env.LASTFM_API_KEY || '',
    lastFmApiUrl: process.env.LASTFM_API_URL || 'https://ws.audioscrobbler.com/2.0/',
    // API Keys
    giphyApiKey: process.env.GIPHY_API_KEY || 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq',
    removeBgKey: process.env.REMOVEBG_KEY || '',
    // Warn system
    warnCount: 3,
    // External APIs
    APIs: {
        xteam: 'https://api.xteam.xyz',
        dzx: 'https://api.dhamzxploit.my.id',
        lol: 'https://api.lolhuman.xyz',
        violetics: 'https://violetics.pw',
        neoxr: 'https://api.neoxr.my.id',
        zenzapis: 'https://zenzapis.xyz',
        akuari: 'https://api.akuari.my.id',
        akuari2: 'https://apimu.my.id',
        nrtm: 'https://fg-nrtm.ddns.net',
        fgmods: 'https://api-fgmods.ddns.net'
    },
    APIKeys: {
        'https://api.xteam.xyz': 'd90a9e986e18778b',
        'https://api.lolhuman.xyz': '85faf717d0545d14074659ad',
        'https://api.neoxr.my.id': process.env.NEOXR_KEY || 'yourkey',
        'https://violetics.pw': 'beta',
        'https://zenzapis.xyz': process.env.ZENZAPIS_KEY || 'yourkey',
        'https://api-fgmods.ddns.net': 'fg-dylux'
    }
};
export default config;
