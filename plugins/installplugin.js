import axios from 'axios';
import fs from 'fs';
import path from 'path';
export default {
    command: 'addplugin',
    aliases: ['installplugin', 'install'],
    category: 'owner',
    description: 'Install a plugin from a GitHub Gist URL (owner only)',
    usage: '.addplugin <Gist URL>',
    /**
     * @param {object} sock - Baileys sock
     * @param {object} message - the original message object
     * @param {Array} args - command arguments
     * @param {object} context - additional context
     */
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        const text = args?.[0];
        if (!text) {
            return await sock.sendMessage(chatId, {
                text: t('p.addplugin.noUrl')
            }, { quoted: message });
        }
        const gistMatch = text.match(/(?:\/|gist\.github\.com\/)([a-fA-F0-9]+)/);
        if (!gistMatch) {
            return await sock.sendMessage(chatId, { text: `❌ ${t('p.addplugin.invalidUrl')}` }, { quoted: message });
        }
        const gistId = gistMatch[1];
        const gistURL = `https://api.github.com/gists/${gistId}`;
        try {
            const response = await axios.get(gistURL);
            const gistData = response.data;
            if (!gistData || !gistData.files) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.addplugin.noFiles')}` }, { quoted: message });
            }
            const pluginDir = path.join(process.cwd(), 'plugins');
            for (const file of Object.values(gistData.files)) {
                const pluginName = file.filename;
                const pluginPath = path.join(pluginDir, pluginName);
                await fs.promises.writeFile(pluginPath, file.content);
            }
            await sock.sendMessage(chatId, { text: `*✅ ${t('p.addplugin.success')}*` }, { quoted: message });
        }
        catch (error) {
            console.error('install plugin error:', error);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.addplugin.error', { error: error.message })}` }, { quoted: message });
        }
    }
};
