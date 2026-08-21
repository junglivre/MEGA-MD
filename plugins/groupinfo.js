export default {
    command: 'groupinfo',
    aliases: ['ginfo', 'gcinfo', 'infogroup'],
    category: 'group',
    description: 'Display detailed group information',
    usage: '.groupinfo',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            let pp;
            try {
                pp = await sock.profilePictureUrl(chatId, 'image');
            }
            catch {
                pp = 'https://i.imgur.com/2wzGhpF.jpeg';
            }
            const participants = groupMetadata.participants;
            const groupAdmins = participants.filter((p) => p.admin);
            const listAdmin = groupAdmins.map((v, i) => `${i + 1}. @${v.id.split('@')[0]}`).join('\n');
            const owner = groupMetadata.owner || groupAdmins.find((p) => p.admin === 'superadmin')?.id || `${chatId.split('-')[0] }@s.whatsapp.net`;
            const text = t('p.groupinfo.info', {
                id: groupMetadata.id,
                subject: groupMetadata.subject,
                memberCount: participants.length,
                owner: owner.split('@')[0],
                admins: listAdmin,
                desc: groupMetadata.desc?.toString() || t('p.groupinfo.noDescription')
            }).trim();
            await sock.sendMessage(chatId, {
                image: { url: pp },
                caption: text,
                mentions: [...groupAdmins.map((v) => v.id), owner],
                ...channelInfo
            });
        }
        catch (error) {
            console.error('Error in groupinfo command:', error);
            await sock.sendMessage(chatId, {
                text: t('p.groupinfo.failed'),
                ...channelInfo
            }, { quoted: message });
        }
    }
};
