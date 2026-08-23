import config from '../config.js';
import store from './lightweight_store.js';
import { pluginMessages } from './i18n-plugins.js';

const LOCALE_ALIASES = {
    'pt': 'pt-BR', 'pt-br': 'pt-BR', 'pt_br': 'pt-BR', 'ptbr': 'pt-BR', 'br': 'pt-BR',
    'brasil': 'pt-BR', 'brasileiro': 'pt-BR', 'brasileira': 'pt-BR', 'portuguese': 'pt-BR', 'portugues': 'pt-BR', 'português': 'pt-BR',
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
        invalidLanguage: 'Idioma inválido. Opções: {languages}.', errorCommand: 'Erro ao executar o comando: {error}', didYouMean: '❓ Você quis dizer *{prefix}{suggestion}*?',
        adminRequired: 'Por favor, torne o bot administrador para usar este comando.',
        adminOnly: 'Desculpe, somente administradores do grupo podem usar este comando.',
        ownerOnlyCommand: 'Este comando está disponível apenas para o proprietário do bot!',
        sudoManageNote: 'Usuários sudo não podem gerenciar outros usuários sudo.',
        ownerOrSudoOnly: 'Este comando está disponível apenas para o proprietário ou usuários sudo!',
        groupOnlyCommand: 'Este comando só pode ser usado em grupos!',
        failedProcessMessage: 'Falha ao processar a mensagem!',
        stickerCommandError: 'Erro ao executar o comando de figurinha: {error}',
        processingError: 'Falha ao processar a mensagem.', chatbotError: 'Ops! 😅 Fiquei um pouco confuso. Tente perguntar novamente.',
        categories: { general: 'Geral', owner: 'Proprietário', admin: 'Administração', group: 'Grupo', download: 'Downloads', ai: 'IA', search: 'Pesquisa', apks: 'APKs', info: 'Informações', fun: 'Diversão', stalk: 'Consultas', games: 'Jogos', images: 'Imagens', menu: 'Menu', tools: 'Ferramentas', stickers: 'Figurinhas', quotes: 'Citações', music: 'Música', utility: 'Utilidades', upload: 'Uploads', misc: 'Diversos' },
        genericDescription: 'Executa o comando {command}.',
        descriptions: { menu: 'Mostra todos os comandos', help: 'Mostra todos os comandos', idioma: 'Escolhe o idioma usado pelo bot', language: 'Escolhe o idioma usado pelo bot', alive: 'Verifica o status e as informações do sistema', owner: 'Mostra o contato do proprietário do bot', chatbot: 'Ativa ou desativa o chatbot de IA do grupo', insidejokes: 'Gerencia bancos de piadas internas usados pela IA', calc: 'Calculadora avançada', translate: 'Traduz um texto para o idioma escolhido', sticker: 'Cria ou edita uma figurinha a partir de imagem, vídeo, GIF ou outra figurinha' },
        p: pluginMessages['pt-BR']
    },
    en: {
        menu: 'MENU', bot: 'Bot', prefix: 'Prefixes', plugins: 'Plugins', version: 'Version', time: 'Time',
        commandInfo: 'COMMAND INFO', command: 'Command', description: 'Description', usage: 'Usage',
        category: 'Category', aliases: 'Aliases', none: 'None', commandNotFound: 'Command not found',
        useMenu: 'Use {prefix}menu to see all commands.', language: 'Language', currentLanguage: 'Current language',
        languageUsage: 'Usage: {prefix}language <language> (e.g. pt-br, ptbr, br, en, es)', languageChanged: 'Language changed to {language}.',
        invalidLanguage: 'Invalid language. Options: {languages}.', errorCommand: 'Error executing command: {error}', didYouMean: '❓ Did you mean *{prefix}{suggestion}*?',
        adminRequired: 'Please make the bot an admin to use this command.',
        adminOnly: 'Sorry, only group admins can use this command.',
        ownerOnlyCommand: 'This command is only available for the bot owner!',
        sudoManageNote: 'Sudo users cannot manage other sudo users.',
        ownerOrSudoOnly: 'This command is only available for the owner or sudo users!',
        groupOnlyCommand: 'This command can only be used in groups!',
        failedProcessMessage: 'Failed to process the message!',
        stickerCommandError: 'Error executing sticker command: {error}',
        processingError: 'Failed to process the message.', chatbotError: 'Oops! 😅 I got a bit confused there. Could you try asking that again?',
        categories: { general: 'General', owner: 'Owner', admin: 'Admin', group: 'Group', download: 'Download', ai: 'AI', search: 'Search', apks: 'APKs', info: 'Info', fun: 'Fun', stalk: 'Stalk', games: 'Games', images: 'Images', menu: 'Menu', tools: 'Tools', stickers: 'Stickers', quotes: 'Quotes', music: 'Music', utility: 'Utility', upload: 'Upload', misc: 'Misc' },
        genericDescription: 'Executes the {command} command.', descriptions: { insidejokes: 'Manage internal joke banks used by the AI' },
        p: pluginMessages.en
    },
    es: {
        menu: 'MENÚ', bot: 'Bot', prefix: 'Prefijos', plugins: 'Plugins', version: 'Versión', time: 'Hora',
        commandInfo: 'INFORMACIÓN DEL COMANDO', command: 'Comando', description: 'Descripción', usage: 'Uso',
        category: 'Categoría', aliases: 'Alias', none: 'Ninguno', commandNotFound: 'Comando no encontrado',
        useMenu: 'Usa {prefix}menu para ver todos los comandos.', language: 'Idioma', currentLanguage: 'Idioma actual',
        languageUsage: 'Uso: {prefix}idioma <pt-br|en|es>', languageChanged: 'Idioma cambiado a {language}.',
        invalidLanguage: 'Idioma inválido. Opciones: {languages}.', errorCommand: 'Error al ejecutar el comando: {error}', didYouMean: '❓ ¿Quisiste decir *{prefix}{suggestion}*?',
        adminRequired: 'Haz administrador al bot para usar este comando.',
        adminOnly: 'Solo los administradores del grupo pueden usar este comando.',
        ownerOnlyCommand: '¡Este comando solo está disponible para el propietario del bot!',
        sudoManageNote: 'Los usuarios sudo no pueden gestionar a otros usuarios sudo.',
        ownerOrSudoOnly: '¡Este comando solo está disponible para el propietario o usuarios sudo!',
        groupOnlyCommand: '¡Este comando solo se puede usar en grupos!',
        failedProcessMessage: '¡No se pudo procesar el mensaje!',
        stickerCommandError: 'Error al ejecutar el comando de pegatina: {error}',
        processingError: 'No se pudo procesar el mensaje.', chatbotError: '¡Ups! 😅 Me confundí un poco. ¿Puedes preguntar de nuevo?',
        categories: { general: 'General', owner: 'Propietario', admin: 'Administración', group: 'Grupo', download: 'Descargas', ai: 'IA', search: 'Búsqueda', apks: 'APKs', info: 'Información', fun: 'Diversión', stalk: 'Consultas', games: 'Juegos', images: 'Imágenes', menu: 'Menú', tools: 'Herramientas', stickers: 'Pegatinas', quotes: 'Citas', music: 'Música', utility: 'Utilidades', upload: 'Subidas', misc: 'Varios' },
        genericDescription: 'Ejecuta el comando {command}.', descriptions: { menu: 'Muestra todos los comandos', help: 'Muestra todos los comandos', idioma: 'Elige el idioma usado por el bot', language: 'Elige el idioma usado por el bot', alive: 'Comprueba el estado y la información del sistema', owner: 'Muestra el contacto del propietario del bot', chatbot: 'Activa o desactiva el chatbot de IA del grupo', insidejokes: 'Gestiona bancos de bromas internas usados por la IA', calc: 'Calculadora avanzada', translate: 'Traduce un texto al idioma elegido', sticker: 'Crea o edita un sticker a partir de imagen, video, GIF u otro sticker' },
        p: pluginMessages.es
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

// Resolves flat keys ('menu') as well as dotted namespaced keys ('p.sticker.noMedia')
// used by individual plugins to keep their strings out of the shared flat namespace.
function resolveKey(dict, key) {
    if (!dict)
        return undefined;
    if (key.indexOf('.') === -1)
        return dict[key];
    return key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), dict);
}

export function translate(language, key, vars = {}) {
    const locale = normalizeLanguage(language);
    let text = resolveKey(messages[locale], key) ?? resolveKey(messages['pt-BR'], key) ?? key;
    if (typeof text !== 'string')
        text = key;
    const prefix = config.prefixes?.find(value => String(value).trim()) || config.prefix || '.';
    const commandPrefixPattern = /(^|[\s`])\.(?=[a-z][a-z0-9_-]*(?:\s|[`<[]|$))/gi;
    const resolved = text.replace(commandPrefixPattern, (_match, leading) => `${leading}${prefix}`);
    return resolved.replace(/\{(\w+)\}/g, (_, name) => ({ prefix, ...vars })[name] ?? `{${name}}`);
}

export function createTranslator(language) {
    const locale = normalizeLanguage(language);
    return (key, vars) => translate(locale, key, vars);
}

export function translateCategory(language, category) {
    const locale = normalizeLanguage(language);
    return messages[locale]?.categories?.[String(category || '').toLowerCase()] || category || 'misc';
}

export function translateCommandDescription(language, command, originalDescription) {
    const locale = normalizeLanguage(language);
    const key = String(command || '').toLowerCase();
    return messages[locale]?.descriptions?.[key]
        || (locale === 'en' ? (originalDescription || messages.en.genericDescription.replace('{command}', key))
            : translate(locale, 'genericDescription', { command: key }));
}

export function languageLabel(language) {
    return normalizeLanguage(language);
}
