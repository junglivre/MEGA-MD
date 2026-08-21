export default {
    command: 'gitclone',
    aliases: ['githubdl', 'clone'],
    category: 'download',
    description: 'Download a GitHub repository as zip',
    usage: '.gitclone <url> OR <username> <repo>',
    async handler(sock, message, args, context) {
        const chatId = message.key.remoteJid;
        const { t } = context;
        if (!args || args.length === 0) {
            return sock.sendMessage(chatId, {
                text: t('p.gitclone.missingRepo')
            });
        }
        let url = '';
        let repoName = '';
        if (args[0].startsWith('http')) {
            const inputUrl = args[0].replace(/\.git$/, '');
            const parts = inputUrl.split('/');
            repoName = parts[parts.length - 1];
            url = inputUrl;
            if (!url.endsWith('/'))
                url += '/';
            url += 'archive/refs/heads/main.zip';
        }
        else if (args.length >= 2) {
            const username = args[0];
            const repo = args[1];
            repoName = repo;
            url = `https://github.com/${username}/${repo}/archive/refs/heads/main.zip`;
        }
        else {
            return sock.sendMessage(chatId, {
                text: t('p.gitclone.missingInfo')
            });
        }
        await sock.sendMessage(chatId, { text: `⏱️ ${t('p.gitclone.preparing')}` });
        try {
            await sock.sendMessage(chatId, {
                document: { url },
                fileName: `${repoName }.zip`,
                mimetype: 'application/zip'
            });
        }
        catch (e) {
            console.error(e);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.gitclone.failed')}`
            });
        }
    }
};
