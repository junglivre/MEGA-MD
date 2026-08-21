import simpleGit from 'simple-git';
export default {
    command: 'gitpull',
    aliases: ['refresh', 'pull'],
    category: 'owner',
    description: 'Reload all plugins (Pull changes from git if available)',
    usage: '.gitpull',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = message.key.remoteJid;
        const { t } = context;
        const commandHandler = (await import('../lib/commandHandler.js')).default;
        const git = simpleGit();
        const start = Date.now();
        let gitStatus = t('p.gitpull.statusLocal');
        try {
            const isRepo = await git.checkIsRepo();
            if (isRepo) {
                const remotes = await git.getRemotes(true);
                if (remotes.some((r) => r.name === 'origin')) {
                    await git.pull();
                    gitStatus = t('p.gitpull.statusPulled');
                }
            }
        }
        catch (err) {
            gitStatus = t('p.gitpull.statusUnavailable');
        }
        try {
            commandHandler.reloadCommands();
            const end = Date.now();
            await sock.sendMessage(chatId, {
                text: t('p.gitpull.success', {
                    status: gitStatus,
                    count: commandHandler.commands.size,
                    ms: end - start
                })
            });
        }
        catch (error) {
            await sock.sendMessage(chatId, {
                text: t('p.gitpull.failed', { error: error.message })
            });
        }
    }
};
