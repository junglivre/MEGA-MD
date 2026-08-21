import { addSudo, removeSudo, getSudoList } from '../lib/index.js';
import isOwnerOrSudo, { cleanJid } from '../lib/isOwner.js';
function extractTargetJid(message, args) {
    if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
        return message.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }
    if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        return message.message.extendedTextMessage.contextInfo.participant;
    }
    const text = args.join(' ');
    const match = text.match(/\b(\d{7,15})\b/);
    if (match)
        return `${match[1] }@s.whatsapp.net`;
    return null;
}
export default {
    command: 'sudo',
    aliases: [],
    category: 'owner',
    description: 'Add or remove sudo users or list them',
    usage: '.sudo add|del|list <@user|number>',
    strictOwnerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const config = context.config;
        const { t } = context;
        const _senderJid = message.key.participant || message.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const isOwner = message.key.fromMe || isOwnerOrSudo;
        const sub = (args[0] || '').toLowerCase();
        if (!sub || !['add', 'del', 'remove', 'list'].includes(sub)) {
            await sock.sendMessage(chatId, {
                text: t('p.sudo.menu')
            }, { quoted: message });
            return;
        }
        if (sub === 'list') {
            const list = await getSudoList();
            if (list.length === 0) {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.sudo.noneFound')}` }, { quoted: message });
                return;
            }
            const textList = list.map((j, i) => `┃ ${i + 1}. @${cleanJid(j)}`).join('\n');
            await sock.sendMessage(chatId, {
                text: t('p.sudo.listView', { list: textList }),
                mentions: list
            }, { quoted: message });
            return;
        }
        if (!isOwner) {
            await sock.sendMessage(chatId, { text: `❌ ${t('p.sudo.accessDenied')}` }, { quoted: message });
            return;
        }
        const targetJid = extractTargetJid(message, args.slice(1));
        if (!targetJid) {
            await sock.sendMessage(chatId, { text: `❌ ${t('p.sudo.noTarget')}` }, { quoted: message });
            return;
        }
        let displayId = cleanJid(targetJid);
        if (targetJid.includes('@lid') && isGroup) {
            try {
                const metadata = await sock.groupMetadata(chatId);
                const found = metadata.participants.find((p) => p.lid === targetJid || p.id === targetJid);
                if (found && found.id && !found.id.includes('@lid')) {
                    displayId = cleanJid(found.id);
                }
            }
            catch (e) { }
        }
        if (sub === 'add') {
            const ok = await addSudo(targetJid);
            await sock.sendMessage(chatId, {
                text: ok ? t('p.sudo.addSuccess', { user: displayId }) : `❌ ${t('p.sudo.addError')}`,
                mentions: [targetJid]
            }, { quoted: message });
            return;
        }
        if (sub === 'del' || sub === 'remove') {
            const ownerNumberClean = cleanJid(config.ownerNumber);
            if (displayId === ownerNumberClean) {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.sudo.cannotRemoveOwner')}` }, { quoted: message });
                return;
            }
            const ok = await removeSudo(targetJid);
            await sock.sendMessage(chatId, {
                text: ok ? t('p.sudo.removeSuccess', { user: displayId }) : `❌ ${t('p.sudo.removeError')}`,
                mentions: [targetJid]
            }, { quoted: message });
        }
    }
};
