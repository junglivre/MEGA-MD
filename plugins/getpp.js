export default {
    command: 'getpp',
    aliases: ['dlpp', 'profilepic', 'getdp'],
    category: 'general',
    description: 'Get user profile picture',
    usage: '.getpp @user or reply or number',
    async handler(sock, message, args, context) {
        const chatId = message.key.remoteJid;
        const { t } = context;
        const isGroup = chatId.endsWith('@g.us');
        let target;
        let displayName = 'Unknown';
        let displayNumber = '';
        const quoted = message.message?.extendedTextMessage?.contextInfo;
        if (quoted?.mentionedJid?.[0]) {
            target = quoted.mentionedJid[0];
        }
        else if (quoted?.participant) {
            target = quoted.participant;
            if (quoted.pushName)
                displayName = quoted.pushName;
        }
        else if (args[0]) {
            const input = args[0].replace(/[^0-9]/g, '');
            if (input.length >= 10) {
                target = `${input }@s.whatsapp.net`;
                displayName = ''; // Will be resolved later, don't show Unknown
            }
            else {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.getpp.invalidNumber')}`
                }, { quoted: message });
            }
        }
        else {
            return await sock.sendMessage(chatId, {
                text: `📸 ${t('p.getpp.usage')}`
            }, { quoted: message });
        }
        try {
            let realJid = target;
            if (target.endsWith('@lid') && isGroup) {
                const metadata = await sock.groupMetadata(chatId);
                const participant = metadata.participants.find((p) => p.lid === target || p.id === target);
                if (participant?.id) {
                    realJid = participant.id;
                }
            }
            const cleanNumber = realJid.replace(/@s\.whatsapp\.net|@lid/g, '').split(':')[0];
            // Only show number if it looks like a real phone number (10+ digits)
            displayNumber = cleanNumber.length >= 10 ? `+${cleanNumber}` : '';
            if (displayName === 'Unknown') {
                try {
                    const name = await sock.getName(realJid);
                    if (name && !name.startsWith('+'))
                        displayName = name;
                }
                catch (e) { }
            }
            let ppUrl = null;
            try {
                ppUrl = await sock.profilePictureUrl(realJid, 'image');
            }
            catch (e) {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.getpp.notFound', { name: displayName, number: displayNumber })}`
                }, { quoted: message });
            }
            if (ppUrl) {
                let caption = `📸 ${t('p.getpp.caption')}`;
                if (displayName && displayName !== 'Unknown')
                    caption += t('p.getpp.nameLine', { name: displayName });
                if (displayNumber)
                    caption += t('p.getpp.numberLine', { number: displayNumber });
                await sock.sendMessage(chatId, {
                    image: { url: ppUrl },
                    caption
                }, { quoted: message });
            }
        }
        catch (error) {
            console.error('GetPP Error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.getpp.failed')}`
            }, { quoted: message });
        }
    }
};
