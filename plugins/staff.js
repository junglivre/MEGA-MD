export default {
    command: 'staff',
    aliases: ['admins', 'adminlist'],
    category: 'group',
    description: 'Display list of group admins',
    usage: '.staff',
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
            const listAdmin = groupAdmins.map((v, i) => `${i + 1}. @${v.id.split('@')[0]}`).join('\n▢ ');
            const owner = groupMetadata.owner || groupAdmins.find((p) => p.admin === 'superadmin')?.id || `${chatId.split('-')[0] }@s.whatsapp.net`;
            const text = `
≡ *${t('p.staff.groupAdminsTitle')}* _${groupMetadata.subject}_

┌─⊷ *${t('p.staff.adminsLabel')}*
▢ ${listAdmin}
└───────────
`.trim();
            await sock.sendMessage(chatId, {
                image: { url: pp },
                caption: text,
                mentions: [...groupAdmins.map((v) => v.id), owner],
                ...channelInfo
            });
        }
        catch (error) {
            console.error('Error in staff command:', error);
            await sock.sendMessage(chatId, {
                text: t('p.staff.failed'),
                ...channelInfo
            }, { quoted: message });
        }
    }
};
