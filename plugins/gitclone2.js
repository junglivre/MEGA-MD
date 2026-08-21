import axios from 'axios';
export default {
    command: 'gitclone2',
    aliases: ['githubdl2', 'clone2'],
    category: 'download',
    description: 'Download a GitHub repository as a ZIP file',
    usage: '.gitclone2 <github-link>',
    async handler(sock, message, args, context) {
        const { chatId, t } = context;
        const regex = new RegExp('(?:https|git)(?://|@)github.com[/:]([^/:]+)/(.+)', 'i');
        try {
            const link = args[0];
            if (!link) {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.gitclone2.noLink')}`
                }, { quoted: message });
            }
            if (!regex.test(link)) {
                return await sock.sendMessage(chatId, { text: `⚠️ ${t('p.gitclone2.invalidLink')}` }, { quoted: message });
            }
            // eslint-disable-next-line prefer-const
            let [_, user, repo] = link.match(regex) || [];
            repo = repo.replace(/.git$/, '');
            const url = `https://api.github.com/repos/${user}/${repo}/zipball`;
            const { default: _axios } = await import('axios');
            const _response = _axios.head;
            const headRes = await axios.head(url);
            const contentDisposition = headRes.headers['content-disposition'];
            let filename = `${repo}.zip`;
            if (contentDisposition) {
                const match = contentDisposition.match(/attachment; filename=(.*)/);
                if (match)
                    filename = match[1];
            }
            await sock.sendMessage(chatId, { text: `✳️ ${t('p.gitclone2.sending')}` }, { quoted: message });
            await sock.sendMessage(chatId, {
                document: { url },
                fileName: filename,
                mimetype: 'application/zip',
                caption: `📦 *${t('p.gitclone2.repoLabel')}:* ${user}/${repo}\n✨ *${t('p.gitclone2.clonedBy')}*`
            }, { quoted: message });
        }
        catch (err) {
            console.error('Gitclone Error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.gitclone2.failed')}` }, { quoted: message });
        }
    }
};
