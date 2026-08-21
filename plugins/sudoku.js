import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
const execAsync = promisify(exec);
export default {
    command: 'sudoku',
    aliases: ['sudokugen', 'sudokusolve', 'sdk'],
    category: 'utility',
    description: 'Generate Sudoku puzzles or solve them',
    usage: '.sudoku generate [easy|medium|hard]\n.sudoku solve <81 digits, 0 for empty>',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        const scriptPath = path.join(process.cwd(), 'lib', 'sudoku.py');
        if (!args.length || args[0] === 'help') {
            return await sock.sendMessage(chatId, {
                text: `🧩 *Sudoku*\n\n` +
                    `*${t('p.sudoku.generateLabel')}:*\n` +
                    `\`.sudoku generate easy\`\n` +
                    `\`.sudoku generate medium\`\n` +
                    `\`.sudoku generate hard\`\n\n` +
                    `*${t('p.sudoku.solveLabel')}:*\n` +
                    `\`.sudoku solve 530070000600195000098000060800060003400803001700020006060000280000419005000080079\`\n\n` +
                    `ℹ️ ${t('p.sudoku.solveHint')}`,
                ...channelInfo
            }, { quoted: message });
        }
        const subCmd = args[0].toLowerCase();
        if (subCmd === 'generate') {
            const difficulty = (args[1] || 'medium').toLowerCase();
            if (!['easy', 'medium', 'hard'].includes(difficulty)) {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.sudoku.invalidDifficulty')}`,
                    ...channelInfo
                }, { quoted: message });
            }
            await sock.sendMessage(chatId, {
                text: `🧩 ${t('p.sudoku.generating', { difficulty })}`,
                ...channelInfo
            }, { quoted: message });
            try {
                const { stdout } = await execAsync(`python3 "${scriptPath}" generate ${difficulty}`, { timeout: 30000 });
                const data = JSON.parse(stdout.trim());
                if (data.error) {
                    return await sock.sendMessage(chatId, {
                        text: `❌ ${data.error}`,
                        ...channelInfo
                    }, { quoted: message });
                }
                const diffEmoji = { easy: '🟢', medium: '🟡', hard: '🔴' };
                await sock.sendMessage(chatId, {
                    text: `🧩 *${t('p.sudoku.headerGenerated', { emoji: diffEmoji[difficulty], difficulty: difficulty.toUpperCase() })}*\n` +
                        `📊 *${t('p.sudoku.clues', { clues: data.clues })}*\n\n` +
                        `*${t('p.sudoku.puzzleLabel')}:*\n\`\`\`\n${data.formatted_puzzle}\n\`\`\`\n\n` +
                        `*${t('p.sudoku.puzzleCodeLabel')}:*\n\`${data.puzzle}\`\n\n` +
                        `_${t('p.sudoku.solveLaterHint', { puzzle: data.puzzle })}_`,
                    ...channelInfo
                }, { quoted: message });
            }
            catch (error) {
                await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.sudoku.generateFailed', { error: error.message })}`,
                    ...channelInfo
                }, { quoted: message });
            }
        }
        else if (subCmd === 'solve') {
            const grid = args[1]?.trim();
            if (!grid) {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.sudoku.provideCode')}\n\n${t('p.sudoku.exampleLabel')}:\n\`.sudoku solve 530070000600195000...\``,
                    ...channelInfo
                }, { quoted: message });
            }
            if (!/^[0-9]{81}$/.test(grid)) {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.sudoku.invalidLength', { length: grid.length })}`,
                    ...channelInfo
                }, { quoted: message });
            }
            await sock.sendMessage(chatId, {
                text: `🔍 ${t('p.sudoku.solving')}`,
                ...channelInfo
            }, { quoted: message });
            try {
                const { stdout } = await execAsync(`python3 "${scriptPath}" solve ${grid}`, { timeout: 30000 });
                const data = JSON.parse(stdout.trim());
                if (data.error) {
                    return await sock.sendMessage(chatId, {
                        text: `❌ ${data.error}`,
                        ...channelInfo
                    }, { quoted: message });
                }
                await sock.sendMessage(chatId, {
                    text: `🧩 *${t('p.sudoku.solvedHeader')}*\n` +
                        `✅ *${t('p.sudoku.filled', { filled: data.filled })}*\n\n` +
                        `*${t('p.sudoku.puzzleLabel')}:*\n\`\`\`\n${data.formatted_puzzle}\n\`\`\`\n\n` +
                        `*${t('p.sudoku.solutionLabel')}:*\n\`\`\`\n${data.formatted_solution}\n\`\`\``,
                    ...channelInfo
                }, { quoted: message });
            }
            catch (error) {
                await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.sudoku.solveFailed', { error: error.message })}`,
                    ...channelInfo
                }, { quoted: message });
            }
        }
        else {
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.sudoku.unknownSubcommand', { subCmd })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
