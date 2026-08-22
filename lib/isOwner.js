import config from '../config.js';
import { isSudo } from './index.js';
import { getAlternateJid, participantMatches } from './jid.js';
function cleanJid(jid) {
    if (!jid)
        return '';
    return jid.split(':')[0].split('@')[0];
}
/**
 * Check if user is owner or sudo
 */
async function isOwnerOrSudo(senderId, sock = null, chatId = null) {
    const ownerNumberClean = cleanJid(config.ownerNumber);
    const ownerLidClean = cleanJid(config.ownerLid);
    const senderIdClean = cleanJid(senderId);
    const alternateSenderIdClean = cleanJid(getAlternateJid(senderId));
    if (senderIdClean === ownerNumberClean || alternateSenderIdClean === ownerNumberClean ||
        (ownerLidClean && senderIdClean === ownerLidClean)) {
        return true;
    }
    const isSudoUser = await isSudo(senderId);
    if (isSudoUser) {
        return true;
    }
    if (sock && chatId && chatId.endsWith('@g.us') && senderId.includes('@lid')) {
        try {
            const metadata = await sock.groupMetadata(chatId);
            const participants = metadata.participants || [];
                const participant = participants.find((p) => participantMatches(p, senderId));
                if (participant) {
                const pRealIdClean = cleanJid(participant.phoneNumber || participant.id);
                if (pRealIdClean === ownerNumberClean || await isSudo(participant.id) || await isSudo(participant.lid)) {
                    return true;
                }
            }
        }
        catch (e) {
        }
    }
    return false;
}
/**
 * Check if user is ONLY owner
 */
function isOwnerOnly(senderId) {
    const ownerNumberClean = cleanJid(config.ownerNumber);
    const ownerLidClean = cleanJid(config.ownerLid);
    const senderIdClean = cleanJid(senderId);
    return senderIdClean === ownerNumberClean || (ownerLidClean && senderIdClean === ownerLidClean);
}
async function isOwnerOnlyInContext(senderId, sock = null, chatId = null) {
    if (isOwnerOnly(senderId))
        return true;
    if (!sock || !chatId || !chatId.endsWith('@g.us') || !senderId?.includes('@lid'))
        return false;
    try {
        const metadata = await sock.groupMetadata(chatId);
        const ownerNumberClean = cleanJid(config.ownerNumber);
        const ownerLidClean = cleanJid(config.ownerLid);
        const participant = (metadata.participants || []).find((p) => participantMatches(p, senderId));
        return Boolean(participant && (cleanJid(participant.phoneNumber || participant.id) === ownerNumberClean ||
            (ownerLidClean && cleanJid(participant.lid || participant.id) === ownerLidClean)));
    }
    catch {
        return false;
    }
}
/**
 * Helper for commands to show clean names/numbers
 * Usage: getCleanName(jid, sock)
 */
async function getCleanName(jid, sock) {
    if (!jid)
        return 'Unknown';
    const cleanNumber = cleanJid(jid);
    try {
        if (sock) {
            const contact = await sock.onWhatsApp(jid);
            if (contact && contact[0] && contact[0].exists) {
                return cleanNumber;
            }
        }
    }
    catch (e) { }
    return cleanNumber;
}
export default isOwnerOrSudo;
export { isOwnerOnly };
export { isOwnerOnlyInContext };
export { cleanJid };
export { getCleanName };
