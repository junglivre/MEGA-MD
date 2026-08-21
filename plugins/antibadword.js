import store from '../lib/lightweight_store.js';
async function getAntibadwordSettings(chatId) {
    const settings = await store.getSetting(chatId, 'antibadword');
    return settings || { enabled: false, words: [] };
}
async function saveAntibadwordSettings(chatId, settings) {
    await store.saveSetting(chatId, 'antibadword', settings);
}
async function handleAntiBadwordCommand(sock, chatId, message, match, t) {
    const args = match.trim().toLowerCase().split(/\s+/);
    const action = args[0];
    const settings = await getAntibadwordSettings(chatId);
    if (!action || action === 'status') {
        const status = settings.enabled ? `✅ ${t('p.antibadword.enabled')}` : `❌ ${t('p.antibadword.disabled')}`;
        const wordCount = settings.words?.length || 0;
        await sock.sendMessage(chatId, {
            text: `*${t('p.antibadword.statusTitle')}*\n\n` +
                `${t('p.antibadword.statusLabel')}: ${status}\n` +
                `${t('p.antibadword.blockedWordsLabel')}: ${wordCount}\n\n` +
                `${t('p.antibadword.useLabel')}:\n` +
                `• \`.antibadword on\` - ${t('p.antibadword.enableHint')}\n` +
                `• \`.antibadword off\` - ${t('p.antibadword.disableHint')}\n` +
                `• \`.antibadword add <word>\` - ${t('p.antibadword.addHint')}\n` +
                `• \`.antibadword remove <word>\` - ${t('p.antibadword.removeHint')}\n` +
                `• \`.antibadword list\` - ${t('p.antibadword.listHint')}`
        }, { quoted: message });
        return;
    }
    if (action === 'on') {
        settings.enabled = true;
        await saveAntibadwordSettings(chatId, settings);
        await sock.sendMessage(chatId, {
            text: `✅ *${t('p.antibadword.enabledTitle')}*\n\n${t('p.antibadword.enabledBody')}`
        }, { quoted: message });
        return;
    }
    if (action === 'off') {
        settings.enabled = false;
        await saveAntibadwordSettings(chatId, settings);
        await sock.sendMessage(chatId, {
            text: `❌ *${t('p.antibadword.disabledTitle')}*\n\n${t('p.antibadword.disabledBody')}`
        }, { quoted: message });
        return;
    }
    if (action === 'add') {
        const word = args.slice(1).join(' ').toLowerCase().trim();
        if (!word) {
            await sock.sendMessage(chatId, {
                text: `❌ *${t('p.antibadword.specifyWordAdd')}*\n\nExample: \`.antibadword add badword\``
            }, { quoted: message });
            return;
        }
        if (!settings.words)
            settings.words = [];
        if (settings.words.includes(word)) {
            await sock.sendMessage(chatId, {
                text: `❌ *${t('p.antibadword.alreadyInList')}*\n\n${t('p.antibadword.alreadyBlocked', { word })}`
            }, { quoted: message });
            return;
        }
        settings.words.push(word);
        await saveAntibadwordSettings(chatId, settings);
        await sock.sendMessage(chatId, {
            text: `✅ *${t('p.antibadword.wordAdded')}*\n\n${t('p.antibadword.addedToList', { word })}\n\n${t('p.antibadword.totalBlocked', { count: settings.words.length })}`
        }, { quoted: message });
        return;
    }
    if (action === 'remove' || action === 'delete' || action === 'del') {
        const word = args.slice(1).join(' ').toLowerCase().trim();
        if (!word) {
            await sock.sendMessage(chatId, {
                text: `❌ *${t('p.antibadword.specifyWordRemove')}*\n\nExample: \`.antibadword remove badword\``
            }, { quoted: message });
            return;
        }
        if (!settings.words || !settings.words.includes(word)) {
            await sock.sendMessage(chatId, {
                text: `❌ *${t('p.antibadword.wordNotFound')}*\n\n${t('p.antibadword.notInList', { word })}`
            }, { quoted: message });
            return;
        }
        settings.words = settings.words.filter((w) => w !== word);
        await saveAntibadwordSettings(chatId, settings);
        await sock.sendMessage(chatId, {
            text: `✅ *${t('p.antibadword.wordRemoved')}*\n\n${t('p.antibadword.removedFromList', { word })}\n\n${t('p.antibadword.remainingBlocked', { count: settings.words.length })}`
        }, { quoted: message });
        return;
    }
    if (action === 'list') {
        if (!settings.words || settings.words.length === 0) {
            await sock.sendMessage(chatId, {
                text: `📝 *${t('p.antibadword.listTitle')}*\n\n${t('p.antibadword.noWordsBlocked')}\n\n${t('p.antibadword.useAddHint')}`
            }, { quoted: message });
            return;
        }
        const wordList = settings.words.map((w, i) => `${i + 1}. ${w}`).join('\n');
        await sock.sendMessage(chatId, {
            text: `📝 *${t('p.antibadword.listTitle')}*\n\n${wordList}\n\n${t('p.antibadword.total', { count: settings.words.length })}`
        }, { quoted: message });
        return;
    }
    await sock.sendMessage(chatId, {
        text: `❌ *${t('p.antibadword.invalidAction')}*\n\n${t('p.antibadword.useLabel')}:\n` +
            '• `.antibadword on/off`\n' +
            '• `.antibadword add <word>`\n' +
            '• `.antibadword remove <word>`\n' +
            '• `.antibadword list`'
    }, { quoted: message });
}
async function checkAntiBadword(sock, message) {
    const chatId = message.key.remoteJid;
    if (!chatId.endsWith('@g.us'))
        return false;
    const settings = await getAntibadwordSettings(chatId);
    if (!settings.enabled || !settings.words || settings.words.length === 0)
        return false;
    const messageText = (message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        message.message?.imageMessage?.caption ||
        message.message?.videoMessage?.caption ||
        '').toLowerCase();
    if (!messageText)
        return false;
    for (const word of settings.words) {
        if (messageText.includes(word.toLowerCase())) {
            try {
                await sock.sendMessage(chatId, { delete: message.key });
                await sock.sendMessage(chatId, {
                    text: `❌ Message deleted: Contains blocked word "${word}"`
                });
                return true;
            }
            catch (error) {
                console.error('Error deleting badword message:', error);
            }
            break;
        }
    }
    return false;
}
export default {
    command: 'antibadword',
    aliases: ['abw', 'badword', 'antibad'],
    category: 'admin',
    description: 'Configure anti-badword filter to delete messages containing inappropriate words',
    usage: '.antibadword <on|off|add|remove|list>',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const match = args.join(' ');
        try {
            await handleAntiBadwordCommand(sock, chatId, message, match, t);
        }
        catch (error) {
            console.error('Error in antibadword command:', error);
            await sock.sendMessage(chatId, {
                text: `❌ *${t('p.antibadword.errorTitle')}*\n\n${t('p.antibadword.errorBody')}`
            }, { quoted: message });
        }
    }
};
export { handleAntiBadwordCommand };
export { checkAntiBadword };
