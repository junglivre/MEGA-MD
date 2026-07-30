import config from '../config.js';
/*****************************************************************************
 *                                                                           *
 *                     Developed By Qasim Ali                                *
 *                                                                           *
 *  🌐  GitHub   : https://github.com/GlobalTechInfo                         *
 *  ▶️  YouTube  : https://youtube.com/@GlobalTechInfo                       *
 *  💬  WhatsApp : https://whatsapp.com/channel/0029VagJIAr3bbVBCpEkAM07     *
 *                                                                           *
 *    © 2026 GlobalTechInfo. All rights reserved.                            *
 *                                                                           *
 *    Description: This file is part of the MEGA-MD Project.                 *
 *                 Unauthorized copying or distribution is prohibited.       *
 *                                                                           *
 *****************************************************************************/
import commandHandler from '../lib/commandHandler.js';
import path from 'path';
import fs from 'fs';
function formatTime() {
    const now = new Date();
    const options = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: config.timeZone || 'UTC'
    };
    return now.toLocaleTimeString('en-US', options);
}
const menuStyles = [
    {
        render({ _title, info, categories, prefix }) {
            let t = `╭━━『 *MEGA MENU* 』━⬣\n`;
            t += `┃ ✨ *Bot: ${info.bot}*\n`;
            t += `┃ 🔧 *Prefix: ${info.prefix}*\n`;
            t += `┃ 📦 *Plugin: ${info.total}*\n`;
            t += `┃ 💎 *Version: ${info.version}*\n`;
            t += `┃ ⏰ *Time: ${info.time}*\n`;
            for (const [cat, cmds] of categories) {
                t += `┃━━━ *${cat.toUpperCase()}* ━✦\n`;
                for (const c of cmds)
                    t += `┃ ➤ ${prefix}${c}\n`;
            }
            t += `╰━━━━━━━━━━━━━⬣`;
            return t;
        }
    },
    {
        render({ _title, info, categories, prefix }) {
            let t = `◈╭─❍「 *MEGA MENU* 」❍\n`;
            t += `◈├• 🌟 *Bot: ${info.bot}*\n`;
            t += `◈├• ⚙️ *Prefix: ${info.prefix}*\n`;
            t += `◈├• 🍫 *Plugins: ${info.total}*\n`;
            t += `◈├• 💎 *Version: ${info.version}*\n`;
            t += `◈├• ⏰ *Time: ${info.time}*\n`;
            for (const [cat, cmds] of categories) {
                t += `◈├─❍「 *${cat.toUpperCase()}* 」❍\n`;
                for (const c of cmds)
                    t += `◈├• ${prefix}${c}\n`;
            }
            t += `◈╰──★─☆──♪♪─❍`;
            return t;
        }
    },
    {
        render({ _title, info, categories, prefix }) {
            let t = `┏━━━━ *MEGA MENU* ━━━┓\n`;
            t += `┃• *Bot : ${info.bot}*\n`;
            t += `┃• *Prefixes : ${info.prefix}*\n`;
            t += `┃• *Plugins : ${info.total}*\n`;
            t += `┃• *Version : ${info.version}*\n`;
            t += `┃• *Time : ${info.time}*\n`;
            for (const [cat, cmds] of categories) {
                t += `┃━━━━ *${cat.toUpperCase()}* ━━◆\n`;
                for (const c of cmds)
                    t += `┃ ▸ ${prefix}${c}\n`;
            }
            t += `┗━━━━━━━━━━━━━━━┛`;
            return t;
        }
    },
    {
        render({ _title, info, categories, prefix }) {
            let t = `✦═══ *MEGA MENU* ═══✦\n`;
            t += `║➩ *Bot: ${info.bot}*\n`;
            t += `║➩ *Prefixes: ${info.prefix}*\n`;
            t += `║➩ *Plugins: ${info.total}*\n`;
            t += `║➩ *Version: ${info.version}*\n`;
            t += `║➩ *Time: ${info.time}*\n`;
            for (const [cat, cmds] of categories) {
                t += `║══ *${cat.toUpperCase()}* ══✧\n`;
                for (const c of cmds)
                    t += `║ ✦ ${prefix}${c}\n`;
            }
            t += `✦══════════════✦`;
            return t;
        }
    },
    {
        render({ _title, info, categories, prefix }) {
            let t = `❀━━━ *MEGA MENU* ━━━❀\n`;
            t += `┃☞ *Bot: ${info.bot}*\n`;
            t += `┃☞ *Prefixes: ${info.prefix}*\n`;
            t += `┃☞ *Plugins: ${info.total}*\n`;
            t += `┃☞ *Version: ${info.version}*\n`;
            t += `┃☞ *Time: ${info.time}*\n`;
            for (const [cat, cmds] of categories) {
                t += `┃━━━〔 *${cat.toUpperCase()}* 〕━❀\n`;
                for (const c of cmds)
                    t += `┃☞ ${prefix}${c}\n`;
            }
            t += `❀━━━━━━━━━━━━━━❀`;
            return t;
        }
    },
    {
        render({ _title, info, categories, prefix }) {
            let t = `◆━━━ *MEGA MENU* ━━━◆\n`;
            t += `┃ ¤ *Bot: ${info.bot}*\n`;
            t += `┃ ¤ *Prefixes: ${info.prefix}*\n`;
            t += `┃ ¤ *Plugins: ${info.total}*\n`;
            t += `┃ ¤ *Version: ${info.version}*\n`;
            t += `┃ ¤ *Time: ${info.time}*\n`;
            for (const [cat, cmds] of categories) {
                t += `┃━━ *${cat.toUpperCase()}* ━━◆◆\n`;
                for (const c of cmds)
                    t += `┃ ¤ ${prefix}${c}\n`;
            }
            t += `◆━━━━━━━━━━━━━━━━◆`;
            return t;
        }
    },
    {
        render({ _title, info, categories, prefix }) {
            let t = `╭───⬣ *MEGA MENU* ──⬣\n`;
            t += ` | ● *Bot: ${info.bot}*\n`;
            t += ` | ● *Prefixes: ${info.prefix}*\n`;
            t += ` | ● *Plugins: ${info.total}*\n`;
            t += ` | ● *Version: ${info.version}*\n`;
            t += ` | ● *Time: ${info.time}*\n`;
            for (const [cat, cmds] of categories) {
                t += ` |───⬣ *${cat.toUpperCase()}* ──⬣\n`;
                for (const c of cmds)
                    t += ` | ● ${prefix}${c}\n`;
            }
            t += `╰──────────⬣`;
            return t;
        }
    }
];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export default {
    command: 'menu',
    aliases: ['help', 'commands', 'h', 'list'],
    category: 'general',
    description: 'Show all commands',
    usage: '.menu [command]',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t = (key) => key } = context;
        const prefix = config.prefixes[0];
        const imagePath = path.join(process.cwd(), 'assets/thumb.png');
        if (args.length) {
            const searchTerm = args[0].toLowerCase();
            let cmd = commandHandler.commands.get(searchTerm);
            if (!cmd && commandHandler.aliases.has(searchTerm)) {
                const mainCommand = commandHandler.aliases.get(searchTerm);
                cmd = commandHandler.commands.get(mainCommand);
            }
            if (!cmd) {
                return sock.sendMessage(chatId, {
                    text: `❌ ${t('commandNotFound')}: "${args[0]}".\n\n${t('useMenu', { prefix })}`,
                    ...channelInfo
                }, { quoted: message });
            }
            const text = `╭━━━━━━━━━━━━━━⬣
┃ 📌 *${t('commandInfo')}*
┃
┃ ⚡ *${t('command')}:* ${prefix}${cmd.command}
┃ 📝 *${t('description')}:* ${cmd.description || t('none')}
┃ 📖 *${t('usage')}:* ${cmd.usage || `${prefix}${cmd.command}`}
┃ 🏷️ *${t('category')}:* ${cmd.category || 'misc'}
┃ 🔖 *${t('aliases')}:* ${cmd.aliases?.length ? cmd.aliases.map((a) => prefix + a).join(', ') : t('none')}
┃
╰━━━━━━━━━━━━━━⬣`;
            if (fs.existsSync(imagePath)) {
                return sock.sendMessage(chatId, {
                    image: { url: imagePath },
                    caption: text,
                    ...channelInfo
                }, { quoted: message });
            }
            return sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });
        }
        const style = pick(menuStyles);
        let text = style.render({
            title: config.botName,
            prefix,
            info: {
                bot: config.botName,
                prefix: config.prefixes.join(', '),
                total: commandHandler.commands.size,
                version: config.version || "6.0.0",
                time: formatTime()
            },
            categories: commandHandler.categories
        });
        text = text.replaceAll('MEGA MENU', t('menu'));
        if (fs.existsSync(imagePath)) {
            await sock.sendMessage(chatId, {
                image: { url: imagePath },
                caption: text,
                ...channelInfo
            }, { quoted: message });
        }
        else {
            await sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });
        }
    }
};
/*****************************************************************************
 *                                                                           *
 *                     Developed By Qasim Ali                                *
 *                                                                           *
 *  🌐  GitHub   : https://github.com/GlobalTechInfo                         *
 *  ▶️  YouTube  : https://youtube.com/@GlobalTechInfo                       *
 *  💬  WhatsApp : https://whatsapp.com/channel/0029VagJIAr3bbVBCpEkAM07     *
 *                                                                           *
 *    © 2026 GlobalTechInfo. All rights reserved.                            *
 *                                                                           *
 *    Description: This file is part of the MEGA-MD Project.                 *
 *                 Unauthorized copying or distribution is prohibited.       *
 *                                                                           *
 *****************************************************************************/
