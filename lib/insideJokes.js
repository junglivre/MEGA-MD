import store from './lightweight_store.js';

const STORAGE_SCOPE = 'global';
const STORAGE_KEY = 'insideJokes';
const PENDING_STORAGE_KEY = 'insideJokePending';
const MAX_BANK_NAME_LENGTH = 32;
const MAX_KEYWORDS = 12;
const MAX_KEYWORD_LENGTH = 80;
const MAX_CONTEXT_LENGTH = 2000;
const MAX_JOKES_PER_BANK = 200;

function emptyState() {
    return { banks: {} };
}

export function normalizeInsideJokeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

export function normalizeBankName(value) {
    return normalizeInsideJokeText(value)
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, MAX_BANK_NAME_LENGTH);
}

function unique(values) {
    return [...new Set(values)];
}

function normalizeKeywords(keywords) {
    return unique((Array.isArray(keywords) ? keywords : [keywords])
        .map(keyword => String(keyword || '').trim().slice(0, MAX_KEYWORD_LENGTH))
        .filter(keyword => keyword.length >= 2))
        .slice(0, MAX_KEYWORDS);
}

function normalizeState(value) {
    if (!value || typeof value !== 'object' || !value.banks || typeof value.banks !== 'object')
        return emptyState();
    return { banks: value.banks };
}

export async function loadInsideJokes() {
    return normalizeState(await store.getSetting(STORAGE_SCOPE, STORAGE_KEY));
}

export async function saveInsideJokes(state) {
    await store.saveSetting(STORAGE_SCOPE, STORAGE_KEY, normalizeState(state));
}

export async function loadInsideJokeFlows() {
    const value = await store.getSetting(STORAGE_SCOPE, PENDING_STORAGE_KEY);
    return value && typeof value === 'object' ? value : {};
}

export async function saveInsideJokeFlows(flows) {
    await store.saveSetting(STORAGE_SCOPE, PENDING_STORAGE_KEY, flows || {});
}

export function getBank(state, name) {
    const key = normalizeBankName(name);
    return key && Object.prototype.hasOwnProperty.call(state?.banks || {}, key)
        ? state.banks[key]
        : null;
}

export function createBank(state, name, ownerId) {
    const displayName = String(name || '').trim().slice(0, MAX_BANK_NAME_LENGTH);
    const key = normalizeBankName(displayName);
    if (!key || displayName.length < 2)
        throw new Error('invalid_name');
    if (Object.prototype.hasOwnProperty.call(state.banks, key))
        throw new Error('already_exists');
    state.banks[key] = {
        name: displayName,
        ownerId: ownerId || '',
        groups: [],
        jokes: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    return state.banks[key];
}

export function addInsideJoke(state, name, keywords, context, createdBy) {
    const bank = getBank(state, name);
    if (!bank)
        throw new Error('not_found');
    bank.jokes = Array.isArray(bank.jokes) ? bank.jokes : [];
    if (bank.jokes.length >= MAX_JOKES_PER_BANK)
        throw new Error('limit_reached');
    const cleanKeywords = normalizeKeywords(keywords);
    const cleanContext = String(context || '').trim().slice(0, MAX_CONTEXT_LENGTH);
    if (!cleanKeywords.length)
        throw new Error('invalid_keywords');
    if (cleanContext.length < 3)
        throw new Error('invalid_context');
    const joke = {
        id: bank.jokes.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
        keywords: cleanKeywords,
        context: cleanContext,
        createdBy: createdBy || '',
        createdAt: Date.now()
    };
    bank.jokes.push(joke);
    bank.updatedAt = Date.now();
    return joke;
}

export function removeInsideJoke(state, name, id) {
    const bank = getBank(state, name);
    if (!bank)
        throw new Error('not_found');
    bank.jokes = Array.isArray(bank.jokes) ? bank.jokes : [];
    const numericId = Number(id);
    const index = bank.jokes.findIndex(joke => Number(joke.id) === numericId);
    if (index === -1)
        throw new Error('joke_not_found');
    const [removed] = bank.jokes.splice(index, 1);
    bank.updatedAt = Date.now();
    return removed;
}

export function linkInsideJokeBank(state, name, chatId) {
    const bank = getBank(state, name);
    if (!bank)
        throw new Error('not_found');
    if (!chatId)
        throw new Error('invalid_group');
    bank.groups = Array.isArray(bank.groups) ? bank.groups : [];
    if (!bank.groups.includes(chatId))
        bank.groups.push(chatId);
    bank.updatedAt = Date.now();
    return bank;
}

export function unlinkInsideJokeBank(state, name, chatId) {
    const bank = getBank(state, name);
    if (!bank)
        throw new Error('not_found');
    bank.groups = Array.isArray(bank.groups) ? bank.groups : [];
    const index = bank.groups.indexOf(chatId);
    if (index === -1)
        throw new Error('group_not_linked');
    bank.groups.splice(index, 1);
    bank.updatedAt = Date.now();
    return bank;
}

export function deleteInsideJokeBank(state, name) {
    const key = normalizeBankName(name);
    if (!Object.prototype.hasOwnProperty.call(state.banks, key))
        throw new Error('not_found');
    const removed = state.banks[key];
    delete state.banks[key];
    return removed;
}

export function findInsideJokes(state, chatId, text, limit = 20) {
    const normalizedMessage = normalizeInsideJokeText(text);
    if (!chatId || !normalizedMessage)
        return [];
    return Object.values(state?.banks || {})
        .filter(bank => Array.isArray(bank.groups) && bank.groups.includes(chatId))
        .flatMap(bank => (Array.isArray(bank.jokes) ? bank.jokes : []).map(joke => ({
            ...joke,
            bankName: bank.name,
            matchedKeywords: joke.keywords.filter(keyword => normalizedMessage.includes(normalizeInsideJokeText(keyword)))
        })))
        .filter(joke => joke.matchedKeywords.length > 0)
        .sort((left, right) => {
            const leftLength = Math.max(...left.matchedKeywords.map(keyword => keyword.length));
            const rightLength = Math.max(...right.matchedKeywords.map(keyword => keyword.length));
            return rightLength - leftLength;
        })
        .slice(0, limit);
}

export const insideJokeLimits = {
    maxBankNameLength: MAX_BANK_NAME_LENGTH,
    maxKeywords: MAX_KEYWORDS,
    maxKeywordLength: MAX_KEYWORD_LENGTH,
    maxContextLength: MAX_CONTEXT_LENGTH,
    maxJokesPerBank: MAX_JOKES_PER_BANK
};
