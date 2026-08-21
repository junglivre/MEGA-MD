import pkg from 'api-qasim';
const QasimAny = pkg;
export default {
    command: 'npmstalk',
    aliases: ['npmstlk'],
    category: 'stalk',
    description: 'Get details about an NPM package',
    usage: '.npmstalk <package-name>',
    async handler(sock, message, args, context) {
        const { chatId, t } = context;
        if (!args[0]) {
            return await sock.sendMessage(chatId, {
                text: `✳️ ${t('p.npmstalk.noPackage')}\n\n${t('p.npmstalk.exampleLabel')}:\n.npmstalk axios`
            }, { quoted: message });
        }
        try {
            const res = await QasimAny.npmStalk(args[0]);
            if (!res || !res.result) {
                throw new Error('Package not found or API error.');
            }
            const data = res.result;
            const authorName = (typeof data.author === 'object') ? data.author.name : (data.author || t('p.npmstalk.unknownAuthor'));
            const versionCount = data.versions ? Object.keys(data.versions).length : 0;
            let te = `┌──「 *${t('p.npmstalk.title')}* 」\n`;
            te += `▢ *🔖${t('p.npmstalk.nameLabel')}:* ${data.name}\n`;
            te += `▢ *🔖${t('p.npmstalk.creatorLabel')}:* ${authorName}\n`;
            te += `▢ *👥${t('p.npmstalk.versionsLabel')}:* ${versionCount}\n`;
            te += `▢ *📌${t('p.npmstalk.descLabel')}:* ${data.description || t('p.npmstalk.noDescription')}\n`;
            te += `▢ *🧩${t('p.npmstalk.repoLabel')}:* ${data.repository?.url || t('p.npmstalk.noRepo')}\n`;
            te += `▢ *🌍${t('p.npmstalk.homepageLabel')}:* ${data.homepage || t('p.npmstalk.noHomepage')}\n`;
            te += `▢ *🏷️${t('p.npmstalk.latestLabel')}:* ${data['dist-tags']?.latest || 'N/A'}\n`;
            te += `▢ *🔗${t('p.npmstalk.linkLabel')}:* https://npmjs.com/package/${data.name}\n`;
            te += `└────────────`;
            await sock.sendMessage(chatId, { text: te }, { quoted: message });
        }
        catch (error) {
            console.error('NPM Stalk Error:', error);
            await sock.sendMessage(chatId, { text: `✳️ ${t('p.npmstalk.error')}` }, { quoted: message });
        }
    }
};
