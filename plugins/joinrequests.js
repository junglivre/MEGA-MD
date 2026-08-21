export default {
    command: 'joinrequests',
    aliases: ['gcreqs', 'groupreqs', 'pendingjoins', 'approvejoin', 'rejectjoin'],
    category: 'group',
    description: 'View, approve or reject group join requests',
    usage: '.joinrequests — list pending\n.approvejoin <number|all>\n.rejectjoin <number|all>',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const rawText = (context.rawText || '').toLowerCase();
        const { t } = context;
        const isApprove = rawText.startsWith('.approvejoin');
        const isReject = rawText.startsWith('.rejectjoin');
        // List pending requests
        if (!isApprove && !isReject) {
            try {
                const requests = await sock.groupRequestParticipantsList(chatId);
                if (!requests || requests.length === 0) {
                    return await sock.sendMessage(chatId, {
                        text: `📋 *${t('p.joinrequests.title')}*\n\n_${t('p.joinrequests.noPending')}_`,
                        ...channelInfo
                    }, { quoted: message });
                }
                const list = requests.map((r, i) => `${i + 1}. +${r.jid.split('@')[0]}`).join('\n');
                return await sock.sendMessage(chatId, {
                    text: `╔═══════════════════════╗\n` +
                        `║   📋 *${t('p.joinrequests.title')}*    ║\n` +
                        `╚═══════════════════════╝\n\n` +
                        `${list}\n\n` +
                        `──────────────────────────\n` +
                        `*${t('p.joinrequests.total')}:* ${requests.length} ${t('p.joinrequests.pending')}\n\n` +
                        `• \`.approvejoin all\` — ${t('p.joinrequests.approveAll')}\n` +
                        `• \`.rejectjoin all\` — ${t('p.joinrequests.rejectAll')}\n` +
                        `• \`.approvejoin 923001234567\` — ${t('p.joinrequests.approveOne')}`,
                    ...channelInfo
                }, { quoted: message });
            }
            catch (e) {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.joinrequests.fetchFailed', { error: e.message })}`,
                    ...channelInfo
                }, { quoted: message });
            }
        }
        // Approve or reject
        const action = isApprove ? 'approve' : 'reject';
        const input = args[0]?.toLowerCase();
        try {
            let targets = [];
            if (input === 'all') {
                const requests = await sock.groupRequestParticipantsList(chatId);
                if (!requests || requests.length === 0) {
                    return await sock.sendMessage(chatId, {
                        text: `⚠️ ${t('p.joinrequests.noPending')}`,
                        ...channelInfo
                    }, { quoted: message });
                }
                targets = requests.map((r) => r.jid);
            }
            else if (input) {
                const num = input.replace(/[^0-9]/g, '');
                targets = [`${num}@s.whatsapp.net`];
            }
            else {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.joinrequests.provideNumberOrAll')}\n\nExample: \`.${isApprove ? 'approvejoin' : 'rejectjoin'} all\``,
                    ...channelInfo
                }, { quoted: message });
            }
            await sock.groupRequestParticipantsUpdate(chatId, targets, action);
            const icon = isApprove ? '✅' : '❌';
            const verb = isApprove ? t('p.joinrequests.approved') : t('p.joinrequests.rejected');
            await sock.sendMessage(chatId, {
                text: `${icon} *${verb}* ${targets.length === 1 ? `+${targets[0].split('@')[0]}` : `${targets.length} ${t('p.joinrequests.requests')}`}`,
                ...channelInfo
            }, { quoted: message });
        }
        catch (e) {
            console.error('[JOINREQUESTS] Error:', e.message);
            const actionLabel = isApprove ? t('p.joinrequests.approve') : t('p.joinrequests.reject');
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.joinrequests.actionFailed', { action: actionLabel, error: e.message })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
