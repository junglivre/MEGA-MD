import fs from 'fs';
import store from './lightweight_store.js';
import { getAlternateJid } from './jid.js';
const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const bannedFilePath = './data/banned.json';
async function isBanned(userId) {
    try {
        if (HAS_DB) {
            const banned = await store.getSetting('global', 'banned');
            return [userId, getAlternateJid(userId)].filter(Boolean).some((id) => (banned || []).includes(id));
        }
        else {
            if (!fs.existsSync(bannedFilePath)) {
                return false;
            }
            const bannedUsers = JSON.parse(fs.readFileSync(bannedFilePath, 'utf8'));
            return [userId, getAlternateJid(userId)].filter(Boolean).some((id) => bannedUsers.includes(id));
        }
    }
    catch (error) {
        console.error('Error checking banned status:', error);
        return false;
    }
}
export { isBanned };
