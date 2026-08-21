import simpleGit from 'simple-git';
export default {
    command: 'gitinfo',
    aliases: ['infogit'],
    category: 'owner',
    description: 'Show detailed git repository information',
    usage: '.gitinfo',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = message.key.remoteJid;
        const { t } = context;
        const git = simpleGit();
        try {
            const isRepo = await git.checkIsRepo();
            if (!isRepo) {
                return sock.sendMessage(chatId, { text: `❌ ${t('p.gitinfo.notRepo')}` });
            }
            const status = await git.status();
            const branch = status.current || 'unknown';
            const dirty = status.files.length > 0;
            const commitHash = (await git.revparse(['--short', 'HEAD'])).trim();
            const ahead = status.ahead;
            const behind = status.behind;
            const modifiedCount = status.files.length;
            const remotes = await git.getRemotes(true);
            const remoteText = remotes.length
                ? remotes.map((r) => `• ${r.name}: ${r.refs.fetch}`).join('\n')
                : t('p.gitinfo.noRemotes');
            const warning = dirty ? t('p.gitinfo.warning') : '';
            const text = t('p.gitinfo.info', {
                branch,
                commit: commitHash,
                treeStatus: dirty ? t('p.gitinfo.dirty') : t('p.gitinfo.clean'),
                warningBlock: dirty ? `${warning}\n\n` : '',
                ahead,
                behind,
                modified: modifiedCount,
                remotes: remoteText
            });
            await sock.sendMessage(chatId, { text });
        }
        catch (err) {
            await sock.sendMessage(chatId, { text: `❌ ${t('p.gitinfo.error', { message: err.message })}` });
        }
    }
};
