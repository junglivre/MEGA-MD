import fs from 'fs';
import store from './lightweight_store.js';
import { dataFile } from './paths.js';
import { getAlternateJid, normalizeJid } from './jid.js';

const HAS_DB = Boolean(process.env.MONGO_URL || process.env.POSTGRES_URL || process.env.MYSQL_URL || process.env.DB_URL);
const BANNED_FILE = dataFile('banned.json');

export function usesBannedUsersDatabase() {
    return HAS_DB;
}

export async function getBannedUsers() {
    if (HAS_DB) {
        const banned = await store.getSetting('global', 'banned');
        return Array.isArray(banned) ? banned : [];
    }
    if (!fs.existsSync(BANNED_FILE))
        return [];
    const banned = JSON.parse(fs.readFileSync(BANNED_FILE, 'utf8'));
    return Array.isArray(banned) ? banned : [];
}

export async function saveBannedUsers(bannedUsers) {
    if (HAS_DB) {
        await store.saveSetting('global', 'banned', bannedUsers);
        return;
    }
    fs.mkdirSync(dataFile(''), { recursive: true });
    fs.writeFileSync(BANNED_FILE, JSON.stringify(bannedUsers, null, 2));
}

export function normalizeBanTarget(value) {
    let target = String(value || '').trim()
        .replace(/^[<'"`]+/, '')
        .replace(/[>'"`,;]+$/, '')
        .replace(/^@(?=\d)/, '');
    const prefixedLid = target.match(/^lid:(\d+)$/i);
    if (prefixedLid)
        target = `${prefixedLid[1]}@lid`;
    if (/^\d+(?::\d+)?@lid$/i.test(target))
        return normalizeJid(target.toLowerCase());
    if (/^\d+(?::\d+)?@s\.whatsapp\.net$/i.test(target))
        return normalizeJid(target.toLowerCase());
    if (/^\d+$/.test(target))
        return target;
    return null;
}

export function findBannedIdentities(bannedUsers, target) {
    const normalizedTarget = normalizeBanTarget(target);
    if (!normalizedTarget)
        return [];
    const hasDomain = normalizedTarget.includes('@');
    const candidates = [normalizedTarget, getAlternateJid(normalizedTarget)]
        .filter(Boolean)
        .map(normalizeJid);
    return (bannedUsers || []).filter((entry) => {
        const normalizedEntry = normalizeJid(entry);
        if (candidates.includes(normalizedEntry))
            return true;
        return !hasDomain && String(normalizedEntry).split('@')[0] === normalizedTarget;
    });
}

export async function isBannedIdentity(userId) {
    return findBannedIdentities(await getBannedUsers(), userId).length > 0;
}
