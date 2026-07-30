import config from '../config.js';
import store from './lightweight_store.js';

const LOCALE_ALIASES = {
    'pt': 'pt-BR', 'pt-br': 'pt-BR', 'pt_br': 'pt-BR', 'ptbr': 'pt-BR', 'br': 'pt-BR',
    'brasil': 'pt-BR', 'portuguese': 'pt-BR', 'portugues': 'pt-BR', 'português': 'pt-BR',
    'português brasileiro': 'pt-BR', 'portugues brasileiro': 'pt-BR', 'pt brasileiro': 'pt-BR',
    'pt-brasileiro': 'pt-BR', 'ptbrasil': 'pt-BR', 'pt-brasil': 'pt-BR',
    'brazilian portuguese': 'pt-BR',
    'en': 'en', 'en-us': 'en', 'en_us': 'en', 'english': 'en', 'ingles': 'en', 'inglês': 'en',
    'us': 'en', 'usa': 'en',
    'es': 'es', 'es-es': 'es', 'es_es': 'es', 'spanish': 'es', 'espanol': 'es', 'español': 'es',
    'castellano': 'es', 'espanhol': 'es', 'espanhol europeu': 'es'
};

export const locales = ['pt-BR', 'en', 'es'];

const messages = {
    'pt-BR': {
        menu: 'MENU', bot: 'Bot', prefix: 'Prefixos', plugins: 'Plugins', version: 'Versão', time: 'Hora',
        commandInfo: 'INFORMAÇÕES DO COMANDO', command: 'Comando', description: 'Descrição', usage: 'Uso',
        category: 'Categoria', aliases: 'Apelidos', none: 'Nenhum', commandNotFound: 'Comando não encontrado',
        useMenu: 'Use {prefix}menu para ver todos os comandos.', language: 'Idioma', currentLanguage: 'Idioma atual',
        languageUsage: 'Uso: {prefix}idioma <idioma> (ex.: pt-br, ptbr, br, português brasileiro, en, es)', languageChanged: 'Idioma alterado para {language}.',
        invalidLanguage: 'Idioma inválido. Opções: {languages}.', errorCommand: 'Erro ao executar o comando: {error}',
        adminRequired: 'Por favor, torne o bot administrador para usar este comando.',
        adminOnly: 'Desculpe, somente administradores do grupo podem usar este comando.',
        processingError: 'Falha ao processar a mensagem.', chatbotError: 'Ops! 😅 Fiquei um pouco confuso. Tente perguntar novamente.'
    },
    en: {
        menu: 'MENU', bot: 'Bot', prefix: 'Prefixes', plugins: 'Plugins', version: 'Version', time: 'Time',
        commandInfo: 'COMMAND INFO', command: 'Command', description: 'Description', usage: 'Usage',
        category: 'Category', aliases: 'Aliases', none: 'None', commandNotFound: 'Command not found',
        useMenu: 'Use {prefix}menu to see all commands.', language: 'Language', currentLanguage: 'Current language',
        languageUsage: 'Usage: {prefix}language <language> (e.g. pt-br, ptbr, br, en, es)', languageChanged: 'Language changed to {language}.',
        invalidLanguage: 'Invalid language. Options: {languages}.', errorCommand: 'Error executing command: {error}',
        adminRequired: 'Please make the bot an admin to use this command.',
        adminOnly: 'Sorry, only group admins can use this command.',
        processingError: 'Failed to process the message.', chatbotError: 'Oops! 😅 I got a bit confused there. Could you try asking that again?'
    },
    es: {
        menu: 'MENÚ', bot: 'Bot', prefix: 'Prefijos', plugins: 'Plugins', version: 'Versión', time: 'Hora',
        commandInfo: 'INFORMACIÓN DEL COMANDO', command: 'Comando', description: 'Descripción', usage: 'Uso',
        category: 'Categoría', aliases: 'Alias', none: 'Ninguno', commandNotFound: 'Comando no encontrado',
        useMenu: 'Usa {prefix}menu para ver todos los comandos.', language: 'Idioma', currentLanguage: 'Idioma actual',
        languageUsage: 'Uso: {prefix}idioma <pt-br|en|es>', languageChanged: 'Idioma cambiado a {language}.',
        invalidLanguage: 'Idioma inválido. Opciones: {languages}.', errorCommand: 'Error al ejecutar el comando: {error}',
        adminRequired: 'Haz administrador al bot para usar este comando.',
        adminOnly: 'Solo los administradores del grupo pueden usar este comando.',
        processingError: 'No se pudo procesar el mensaje.', chatbotError: '¡Ups! 😅 Me confundí un poco. ¿Puedes preguntar de nuevo?'
    }
};

export function normalizeLanguage(value, fallback = config.defaultLanguage) {
    const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return LOCALE_ALIASES[normalized] || (locales.includes(value) ? value : normalizeLanguage(fallback, 'pt-BR'));
}

export async function getUserLanguage(userId) {
    const saved = userId ? await store.getUserSetting(userId, 'userLanguage') : null;
    return normalizeLanguage(saved);
}

export async function setUserLanguage(userId, language) {
    const raw = String(language || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const normalized = LOCALE_ALIASES[raw];
    if (!normalized || !locales.includes(normalized))
        return null;
    await store.saveUserSetting(userId, 'userLanguage', normalized);
    return normalized;
}

export function translate(language, key, vars = {}) {
    const locale = normalizeLanguage(language);
    let text = messages[locale]?.[key] || messages['pt-BR'][key] || key;
    return text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? `{${name}}`);
}

export function createTranslator(language) {
    const locale = normalizeLanguage(language);
    return (key, vars) => translate(locale, key, vars);
}

export function languageLabel(language) {
    return normalizeLanguage(language);
}
