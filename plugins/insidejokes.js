import {
    addInsideJoke,
    createBank,
    deleteInsideJokeBank,
    getBank,
    linkInsideJokeBank,
    loadInsideJokes,
    removeInsideJoke,
    saveInsideJokes,
    unlinkInsideJokeBank
} from '../lib/insideJokes.js';
import config from '../config.js';
import { createTranslator, getUserLanguage } from '../lib/i18n.js';

const pendingFlows = new Map();
const FLOW_TTL_MS = 5 * 60 * 1000;
const COMMAND_ALIASES = new Set(['bancopiadas', 'bpiadas', 'insidejokes']);

function cleanIdentity(value) {
    return String(value || '').split(':')[0].split('@')[0];
}

function isConfiguredOwner(senderId) {
    const sender = cleanIdentity(senderId);
    return [config.ownerNumber, config.ownerLid].filter(Boolean).some(owner => cleanIdentity(owner) === sender);
}

function send(sock, chatId, text, message) {
    return sock.sendMessage(chatId, { text }, { quoted: message });
}

function commandArguments(context) {
    const rawText = String(context.rawText || context.messageText || '').trim();
    return rawText.replace(/^\S+\s*/, '').trim();
}

function parseBankAndRest(value) {
    const match = String(value || '').trim().match(/^(\S+)(?:\s+([\s\S]*))?$/);
    return { bankName: match?.[1] || '', rest: match?.[2]?.trim() || '' };
}

function parseAddPayload(value) {
    const { bankName, rest } = parseBankAndRest(value);
    const separator = rest.indexOf('|');
    if (separator === -1)
        return { bankName, keywords: '', context: '' };
    return {
        bankName,
        keywords: rest.slice(0, separator).trim(),
        context: rest.slice(separator + 1).trim()
    };
}

function flowKey(chatId, senderId) {
    return `${chatId}:${senderId}`;
}

function isCancelCommand(rawText, prefixes = []) {
    const parts = String(rawText || '').trim().split(/\s+/);
    const commandToken = parts[0]?.toLowerCase() || '';
    const prefix = prefixes.find(item => commandToken.startsWith(item));
    if (!prefix || !COMMAND_ALIASES.has(commandToken.slice(prefix.length)))
        return false;
    return ['cancelar', 'cancel', 'cancela'].includes(parts[1]?.toLowerCase());
}

function isAnyPrefixedCommand(rawText, prefixes = []) {
    const commandToken = String(rawText || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
    return prefixes.some(prefix => commandToken.startsWith(prefix));
}

function normalizeFlowKeywords(value) {
    return String(value || '').split(',').map(keyword => keyword.trim()).filter(Boolean);
}

function startFlow(chatId, senderId, bankName, step = 'keywords', keywords = []) {
    pendingFlows.set(flowKey(chatId, senderId), {
        chatId,
        senderId,
        bankName,
        step,
        keywords,
        expiresAt: Date.now() + FLOW_TTL_MS
    });
}

function removeExpiredFlows() {
    const now = Date.now();
    for (const [key, flow] of pendingFlows.entries()) {
        if (flow.expiresAt <= now)
            pendingFlows.delete(key);
    }
}

export function hasPendingInsideJokeWizard(chatId) {
    removeExpiredFlows();
    return [...pendingFlows.values()].some(flow => flow.chatId === chatId);
}

export async function handleInsideJokesWizard(sock, message, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const senderId = context.senderId || message.key.participant || chatId;
    let key = flowKey(chatId, senderId);
    let flow = pendingFlows.get(key);
    // The same owner can arrive as LID in one message and PN/another LID form
    // in the next one. Owner-only fallback keeps the wizard tied to the same
    // group without allowing another group member to hijack it.
    if (!flow && isConfiguredOwner(senderId)) {
        const pendingEntry = [...pendingFlows.entries()].find(([, item]) => item.chatId === chatId);
        if (pendingEntry) {
            [key, flow] = pendingEntry;
        }
    }
    if (!flow)
        return false;
    const t = context.t || createTranslator(await getUserLanguage(senderId));
    const rawText = String(context.rawText || '').trim();
    if (Date.now() > flow.expiresAt) {
        pendingFlows.delete(key);
        await send(sock, chatId, `⌛ ${t('p.insidejokes.flowExpired')}`, message);
        return true;
    }
    if (isCancelCommand(rawText, context.config?.prefixes || [])) {
        pendingFlows.delete(key);
        await send(sock, chatId, `✅ ${t('p.insidejokes.flowCanceled')}`, message);
        return true;
    }
    if (!rawText || isAnyPrefixedCommand(rawText, context.config?.prefixes || []))
        return false;
    if (flow.step === 'keywords') {
        const keywords = normalizeFlowKeywords(rawText);
        if (!keywords.length) {
            await send(sock, chatId, `❌ ${t('p.insidejokes.invalidKeywords')}\n\n${t('p.insidejokes.askKeywords')}`, message);
            return true;
        }
        flow.keywords = keywords;
        flow.step = 'context';
        flow.expiresAt = Date.now() + FLOW_TTL_MS;
        pendingFlows.set(key, flow);
        await send(sock, chatId, `✅ ${t('p.insidejokes.tagsReceived')}\n\n${t('p.insidejokes.askContext')}`, message);
        return true;
    }
    try {
        const state = await loadInsideJokes();
        const joke = addInsideJoke(state, flow.bankName, flow.keywords, rawText, senderId);
        await saveInsideJokes(state);
        pendingFlows.delete(key);
        await send(sock, chatId, `✅ ${t('p.insidejokes.jokeAdded', { id: joke.id, bank: getBank(state, flow.bankName).name })}`, message);
    }
    catch (error) {
        const errorKey = error.message === 'invalid_keywords' ? 'invalidKeywords' :
            error.message === 'invalid_context' ? 'invalidContext' : 'genericError';
        await send(sock, chatId, `❌ ${t(`p.insidejokes.${errorKey}`)}\n\n${t('p.insidejokes.askContext')}`, message);
    }
    return true;
}

function helpText(t) {
    return `*🃏 ${t('p.insidejokes.title')}*\n\n` +
        `${t('p.insidejokes.intro')}\n\n` +
        `• \`.bancopiadas criar <nome>\`\n` +
        `• \`.bancopiadas adicionar <nome>\` *(depois responda às perguntas)*\n` +
        `• \`.bancopiadas listar [nome]\`\n` +
        `• \`.bancopiadas vincular <nome>\` *(no grupo)*\n` +
        `• \`.bancopiadas desvincular <nome>\` *(no grupo)*\n` +
        `• \`.bancopiadas remover <nome> <id>\`\n` +
        `• \`.bancopiadas apagar <nome>\`\n\n` +
        `_${t('p.insidejokes.example')}_`;
}

function formatBank(bank, t) {
    const jokes = bank.jokes || [];
    const lines = jokes.length
        ? jokes.map(joke => `${joke.id}. *${joke.keywords.join(', ')}* — ${joke.context}`).join('\n')
        : t('p.insidejokes.noJokes');
    return `*${bank.name}*\n` +
        `${t('p.insidejokes.jokesCount', { count: jokes.length })}\n` +
        `${t('p.insidejokes.groupsCount', { count: (bank.groups || []).length })}\n\n${lines}`;
}

export default {
    command: 'bancopiadas',
    aliases: ['bpiadas', 'insidejokes'],
    category: 'ai',
    description: 'Manage internal joke banks used as context for the AI',
    usage: '.bancopiadas <criar|adicionar|listar|vincular|desvincular|remover|apagar>',
    ownerOnly: true,
    cooldown: 1000,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const senderId = context.senderId || message.key.participant || chatId;
        const t = context.t;
        const action = String(args[0] || '').toLowerCase();
        const rest = commandArguments(context).replace(/^\S+\s*/i, '');

        if (!action)
            return send(sock, chatId, helpText(t), message);

        const state = await loadInsideJokes();
        try {
            if (action === 'criar' || action === 'create') {
                const bankName = rest.trim();
                const bank = createBank(state, bankName, senderId);
                await saveInsideJokes(state);
                return send(sock, chatId, `✅ ${t('p.insidejokes.created', { name: bank.name })}`, message);
            }

            if (action === 'adicionar' || action === 'add') {
                const payload = parseAddPayload(rest);
                if (!payload.context) {
                    if (!getBank(state, payload.bankName))
                        throw new Error('not_found');
                    const keywords = normalizeFlowKeywords(payload.keywords);
                    startFlow(chatId, senderId, payload.bankName, keywords.length ? 'context' : 'keywords', keywords);
                    return send(sock, chatId, keywords.length
                        ? `📝 ${t('p.insidejokes.askContext')}`
                        : `📝 ${t('p.insidejokes.askKeywords')}`, message);
                }
                const keywords = payload.keywords.split(',').map(keyword => keyword.trim()).filter(Boolean);
                const joke = addInsideJoke(state, payload.bankName, keywords, payload.context, senderId);
                await saveInsideJokes(state);
                return send(sock, chatId, `✅ ${t('p.insidejokes.jokeAdded', { id: joke.id, bank: getBank(state, payload.bankName).name })}`, message);
            }

            if (action === 'listar' || action === 'list') {
                const bankName = rest.trim();
                if (bankName) {
                    const bank = getBank(state, bankName);
                    if (!bank)
                        return send(sock, chatId, `❌ ${t('p.insidejokes.notFound')}`, message);
                    return send(sock, chatId, formatBank(bank, t), message);
                }
                const banks = Object.values(state.banks);
                if (!banks.length)
                    return send(sock, chatId, t('p.insidejokes.empty'), message);
                const list = banks.map(bank => `• *${bank.name}* — ${t('p.insidejokes.jokesCount', { count: (bank.jokes || []).length })}, ${t('p.insidejokes.groupsCount', { count: (bank.groups || []).length })}`).join('\n');
                return send(sock, chatId, `*🃏 ${t('p.insidejokes.banks')}*\n\n${list}`, message);
            }

            if (action === 'vincular' || action === 'link') {
                if (!chatId.endsWith('@g.us'))
                    return send(sock, chatId, `❌ ${t('p.insidejokes.groupOnly')}`, message);
                const bank = linkInsideJokeBank(state, rest, chatId);
                await saveInsideJokes(state);
                return send(sock, chatId, `✅ ${t('p.insidejokes.linked', { name: bank.name })}`, message);
            }

            if (action === 'desvincular' || action === 'unlink') {
                if (!chatId.endsWith('@g.us'))
                    return send(sock, chatId, `❌ ${t('p.insidejokes.groupOnly')}`, message);
                const bank = unlinkInsideJokeBank(state, rest, chatId);
                await saveInsideJokes(state);
                return send(sock, chatId, `✅ ${t('p.insidejokes.unlinked', { name: bank.name })}`, message);
            }

            if (action === 'remover' || action === 'remove') {
                const match = rest.match(/^(\S+)\s+(\d+)$/);
                const removed = match ? removeInsideJoke(state, match[1], match[2]) : null;
                if (!removed)
                    throw new Error('joke_not_found');
                await saveInsideJokes(state);
                return send(sock, chatId, `✅ ${t('p.insidejokes.jokeRemoved', { id: removed.id })}`, message);
            }

            if (action === 'apagar' || action === 'delete') {
                const bank = deleteInsideJokeBank(state, rest);
                await saveInsideJokes(state);
                return send(sock, chatId, `✅ ${t('p.insidejokes.deleted', { name: bank.name })}`, message);
            }

            return send(sock, chatId, helpText(t), message);
        }
        catch (error) {
            const errorKey = {
                invalid_name: 'invalidName',
                already_exists: 'alreadyExists',
                not_found: 'notFound',
                invalid_keywords: 'invalidKeywords',
                invalid_context: 'invalidContext',
                limit_reached: 'limitReached',
                joke_not_found: 'jokeNotFound',
                invalid_group: 'invalidGroup',
                group_not_linked: 'groupNotLinked'
            }[error.message] || 'genericError';
            return send(sock, chatId, `❌ ${t(`p.insidejokes.${errorKey}`)}`, message);
        }
    }
};
