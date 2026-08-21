import store from '../lib/lightweight_store.js';
const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const notesDB = {};
async function getUserNotes(userId) {
    if (HAS_DB) {
        const notes = await store.getSetting(userId, 'notes');
        return notes || [];
    }
    else {
        return notesDB[userId] || [];
    }
}
async function saveUserNotes(userId, notes) {
    if (HAS_DB) {
        await store.saveSetting(userId, 'notes', notes);
    }
    else {
        notesDB[userId] = notes;
    }
}
export default {
    command: 'notes',
    aliases: ['note'],
    category: 'menu',
    description: 'Store, view, and delete your personal notes',
    usage: '.notes <add|all|del|delall> [text|ID]',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;
        const { t } = context;
        try {
            const action = args[0] ? args[0].toLowerCase() : null;
            const content = args.slice(1).join(" ").trim();
            const menuText = `
╭───── *『 NOTES 』* ───◆
┃ ${t('p.notes.menuIntro')}
┃ ${t('p.notes.storageLabel')}: ${HAS_DB ? t('p.notes.storageDb') : t('p.notes.storageMemory')}
┃
┃ ● ${t('p.notes.addLabel')}
┃    .notes add your text here
┃
┃ ● ${t('p.notes.allLabel')}
┃    .notes all
┃
┃ ● ${t('p.notes.delLabel')}
┃    .notes del noteID
┃
┃ ● ${t('p.notes.delallLabel')}
┃    .notes delall
╰━━━━━━━━━━━━━━━━━──⊷`;
            if (!action) {
                return await sock.sendMessage(chatId, { text: menuText }, { quoted: message });
            }
            if (action === 'add') {
                if (!content) {
                    return await sock.sendMessage(chatId, {
                        text: `*${t('p.notes.addUsageTitle')}*\n${t('p.notes.exampleLabel')}: .notes add buy milk`
                    }, { quoted: message });
                }
                const userNotes = await getUserNotes(sender);
                const newID = userNotes.length + 1;
                userNotes.push({ id: newID, text: content, createdAt: Date.now() });
                await saveUserNotes(sender, userNotes);
                return await sock.sendMessage(chatId, {
                    text: `✅ ${t('p.notes.savedTitle')}\n${t('p.notes.idLabel')}: ${newID}\n${t('p.notes.storageLabel')}: ${HAS_DB ? t('p.notes.storageDbPlain') : t('p.notes.storageMemoryPlain')}`
                }, { quoted: message });
            }
            if (action === 'all') {
                const userNotes = await getUserNotes(sender);
                if (userNotes.length === 0) {
                    return await sock.sendMessage(chatId, { text: `*${t('p.notes.noNotes')}*` }, { quoted: message });
                }
                const list = userNotes.map((n) => `${n.id}. ${n.text}`).join("\n");
                return await sock.sendMessage(chatId, {
                    text: `*📝 ${t('p.notes.yourNotesTitle')}:*\n\n${list}\n\n_${t('p.notes.totalNotes', { count: userNotes.length })}_`
                }, { quoted: message });
            }
            if (action === 'del') {
                const id = parseInt(args[1], 10);
                const userNotes = await getUserNotes(sender);
                if (!id || !userNotes.find((n) => n.id === id)) {
                    return await sock.sendMessage(chatId, {
                        text: `${t('p.notes.invalidId')}\n${t('p.notes.exampleLabel')}: .notes del 1`
                    }, { quoted: message });
                }
                const filteredNotes = userNotes.filter((n) => n.id !== id);
                await saveUserNotes(sender, filteredNotes);
                return await sock.sendMessage(chatId, { text: `*✅ ${t('p.notes.deletedNote', { id })}*` }, { quoted: message });
            }
            if (action === 'delall') {
                const userNotes = await getUserNotes(sender);
                if (userNotes.length === 0) {
                    return await sock.sendMessage(chatId, { text: `*${t('p.notes.noNotesToDelete')}*` }, { quoted: message });
                }
                await saveUserNotes(sender, []);
                return await sock.sendMessage(chatId, { text: `*✅ ${t('p.notes.allDeleted')}*` }, { quoted: message });
            }
            return await sock.sendMessage(chatId, { text: menuText }, { quoted: message });
        }
        catch (err) {
            console.error("Notes Command Error:", err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.notes.moduleError')}` }, { quoted: message });
        }
    }
};
