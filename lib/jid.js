/**
 * Baileys v7 prefers LIDs. Keep the preferred JID as the canonical identity
 * and only use alternate JIDs for matching, never as a replacement key.
 */
export function normalizeJid(jid) {
    if (!jid)
        return jid;
    const match = String(jid).match(/^([^:]+):(\d+)@(.*)$/);
    return match ? `${match[1]}@${match[3]}` : String(jid);
}

const lidToPn = new Map();
export function rememberLidMapping(mapping) {
    const entries = Array.isArray(mapping) ? mapping : [mapping];
    for (const item of entries) {
        if (item?.lid && item?.pn)
            lidToPn.set(normalizeJid(item.lid), normalizeJid(item.pn));
    }
}

export function getAlternateJid(jid) {
    return lidToPn.get(normalizeJid(jid));
}

export function getMessageSenderJid(message) {
    const key = message?.key || {};
    return normalizeJid(key.participant || key.remoteJid || key.participantAlt || key.remoteJidAlt);
}

export function getMessageJidAlternatives(message) {
    const key = message?.key || {};
    return [...new Set([
        key.participant,
        key.participantAlt,
        key.remoteJid,
        key.remoteJidAlt
    ].filter(Boolean).map(normalizeJid))];
}

export function participantMatches(participant, jid) {
    if (!participant || !jid)
        return false;
    const wanted = normalizeJid(jid);
    const aliases = [participant.id, participant.lid, participant.phoneNumber, getAlternateJid(wanted)]
        .filter(Boolean)
        .map(normalizeJid)
    return aliases.includes(wanted) || aliases.includes(getAlternateJid(wanted));
}
