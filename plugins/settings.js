import isOwnerOrSudo, { cleanJid } from '../lib/isOwner.js';
import { getChatbot, getWelcome, getGoodbye, getAntitag } from '../lib/index.js';
import store from '../lib/lightweight_store.js';
export default {
    command: 'settings',
    aliases: ['config', 'setting'],
    category: 'owner',
    description: 'Show bot settings and per-group configurations',
    usage: '.settings',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const senderId = message.key.participant || message.key.remoteJid;
        const { t } = context;
        try {
            const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
            const isMe = message.key.fromMe;
            if (!isMe && !isOwner) {
                return await sock.sendMessage(chatId, {
                    text: `❌ *${t('p.settings.accessDeniedTitle')}:* ${t('p.settings.accessDeniedHint')}`
                }, { quoted: message });
            }
            const isGroup = chatId.endsWith('@g.us');
            const botMode = await store.getBotMode();
            const autoStatus = await store.getSetting('global', 'autoStatus') || { enabled: false };
            const autoread = await store.getSetting('global', 'autoread') || { enabled: false };
            const autotyping = await store.getSetting('global', 'autotyping') || { enabled: false };
            const pmblocker = await store.getSetting('global', 'pmblocker') || { enabled: false };
            const anticall = await store.getSetting('global', 'anticall') || { enabled: false };
            const autoReactionData = await store.getSetting('global', 'autoReaction');
            const mentionData = await store.getSetting('global', 'mention');
            const autoReaction = autoReactionData?.enabled || false;
            const stealthMode = await store.getSetting('global', 'stealthMode') || { enabled: false };
            const autoBio = await store.getSetting('global', 'autoBio') || { enabled: false };
            // cmdreact saves to userGroupData.json as data.autoReaction
            const fs = (await import('fs')).default;
            let cmdReactEnabled = true;
            try {
                const ugd = JSON.parse(fs.readFileSync('./data/userGroupData.json', 'utf-8'));
                cmdReactEnabled = ugd.autoReaction ?? true;
            }
            catch {
                cmdReactEnabled = true;
            }
            const getSt = (val) => val ? '✅' : '❌';
            let menuText = `╭━〔 *${t('p.settings.title')}* 〕━┈\n┃\n`;
            menuText += `┃ 👤 *${t('p.settings.userLabel')}:* @${cleanJid(senderId)}\n`;
            menuText += `┃ 🤖 *${t('p.settings.modeLabel')}:* ${botMode.toUpperCase()}\n`;
            menuText += `┃\n┣━〔 *${t('p.settings.globalConfigHeader')}* 〕━┈\n`;
            menuText += `┃ ${getSt(autoStatus?.enabled)} *${t('p.settings.autoStatus')}*\n`;
            menuText += `┃ ${getSt(autoread?.enabled)} *${t('p.settings.autoRead')}*\n`;
            menuText += `┃ ${getSt(autotyping?.enabled)} *${t('p.settings.autoTyping')}*\n`;
            menuText += `┃ ${getSt(pmblocker?.enabled)} *${t('p.settings.pmBlocker')}*\n`;
            menuText += `┃ ${getSt(anticall?.enabled)} *${t('p.settings.antiCall')}*\n`;
            menuText += `┃ ${getSt(autoReaction)} *${t('p.settings.autoReaction')}*\n`;
            menuText += `┃ ${getSt(cmdReactEnabled)} *${t('p.settings.cmdReactions')}*\n`;
            menuText += `┃ ${getSt(stealthMode?.enabled)} *${t('p.settings.stealthMode')}*\n`;
            menuText += `┃ ${getSt(autoBio?.enabled)} *${t('p.settings.autoBio')}*\n`;
            menuText += `┃ ${getSt(mentionData?.enabled)} *${t('p.settings.mentionAlert')}*\n`;
            menuText += `┃\n`;
            if (isGroup) {
                const groupSettings = await store.getAllSettings(chatId);
                const groupAntilink = groupSettings.antilink || { enabled: false };
                const groupBadword = groupSettings.antibadword || { enabled: false };
                const antitag = await getAntitag(chatId, 'on');
                const groupAntitag = { enabled: !!antitag };
                const chatbotData = await getChatbot(chatId);
                const welcomeData = await getWelcome(chatId);
                const goodbyeData = await getGoodbye(chatId);
                // getChatbot returns true/false or {enabled}
                const groupChatbot = chatbotData === true || chatbotData?.enabled || false;
                // getWelcome returns null or message string or {enabled}
                const groupWelcome = welcomeData !== null && welcomeData !== undefined && welcomeData !== false;
                // getGoodbye returns null or message string or {enabled}
                const groupGoodbye = goodbyeData !== null && goodbyeData !== undefined && goodbyeData !== false;
                menuText += `┣━〔 *${t('p.settings.groupConfigHeader')}* 〕━┈\n`;
                menuText += `┃ ${getSt(groupAntilink.enabled)} *${t('p.settings.antilink')}*\n`;
                menuText += `┃ ${getSt(groupBadword.enabled)} *${t('p.settings.antibadword')}*\n`;
                menuText += `┃ ${getSt(groupAntitag.enabled)} *${t('p.settings.antitag')}*\n`;
                menuText += `┃ ${getSt(groupChatbot)} *${t('p.settings.chatbot')}*\n`;
                menuText += `┃ ${getSt(groupWelcome)} *${t('p.settings.welcome')}*\n`;
                menuText += `┃ ${getSt(groupGoodbye)} *${t('p.settings.goodbye')}*\n`;
            }
            else {
                menuText += `┃ 💡 *${t('p.settings.noteLabel')}:* _${t('p.settings.groupOnlyNote')}_\n`;
            }
            menuText += `┃\n╰━━━━━━━━━━━━━━━━┈`;
            await sock.sendMessage(chatId, {
                text: menuText,
                mentions: [senderId],
                contextInfo: {
                    externalAdReply: {
                        title: t('p.settings.adTitle'),
                        body: t('p.settings.adBody'),
                        thumbnailUrl: "https://github.com/junglivre.png",
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: message });
        }
        catch (error) {
            console.error('Settings Command Error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.settings.loadError')}`
            }, { quoted: message });
        }
    }
};
