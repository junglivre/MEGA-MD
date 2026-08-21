import TicTacToe from '../lib/tictactoe.js';
import { createTranslator, getUserLanguage } from '../lib/i18n.js';
const games = {};
export async function handleTicTacToeMove(sock, chatId, senderId, text) {
    const t = createTranslator(await getUserLanguage(senderId));
    try {
        const room = Object.values(games).find((room) => room.id.startsWith('tictactoe') &&
            [room.game.playerX, room.game.playerO].includes(senderId) &&
            room.state === 'PLAYING');
        if (!room)
            return;
        const isSurrender = /^(surrender|give up)$/i.test(text);
        if (!isSurrender && !/^[1-9]$/.test(text))
            return;
        if (senderId !== room.game.currentTurn && !isSurrender) {
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.tictactoe.notYourTurn')}`
            });
            return;
        }
        const ok = isSurrender ? true : room.game.turn(senderId === room.game.playerO, parseInt(text, 10) - 1);
        if (!ok) {
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.tictactoe.invalidMove')}`
            });
            return;
        }
        let winner = room.game.winner;
        const isTie = room.game.turns === 9;
        const arr = room.game.render().map((v) => ({
            'X': '❎',
            'O': '⭕',
            '1': '1️⃣',
            '2': '2️⃣',
            '3': '3️⃣',
            '4': '4️⃣',
            '5': '5️⃣',
            '6': '6️⃣',
            '7': '7️⃣',
            '8': '8️⃣',
            '9': '9️⃣',
        }[v] || v));
        if (isSurrender) {
            winner = senderId === room.game.playerX ? room.game.playerO : room.game.playerX;
            await sock.sendMessage(chatId, {
                text: `🏳️ ${t('p.tictactoe.surrendered', { loser: `@${senderId.split('@')[0]}`, winner: `@${winner.split('@')[0]}` })}`,
                mentions: [senderId, winner]
            });
            delete games[room.id];
            return;
        }
        let gameStatus;
        if (winner) {
            gameStatus = `🎉 ${t('p.tictactoe.winMessage', { winner: `@${winner.split('@')[0]}` })}`;
        }
        else if (isTie) {
            gameStatus = `🤝 ${t('p.tictactoe.draw')}`;
        }
        else {
            gameStatus = `🎲 ${t('p.tictactoe.turnStatus', { player: `@${room.game.currentTurn.split('@')[0]}`, symbol: senderId === room.game.playerX ? '❎' : '⭕' })}`;
        }
        const str = `
🎮 *${t('p.tictactoe.gameTitle')}*

${gameStatus}

${arr.slice(0, 3).join('')}
${arr.slice(3, 6).join('')}
${arr.slice(6).join('')}

▢ ${t('p.tictactoe.playerLabel')} ❎: @${room.game.playerX.split('@')[0]}
▢ ${t('p.tictactoe.playerLabel')} ⭕: @${room.game.playerO.split('@')[0]}

${!winner && !isTie ? t('p.tictactoe.instructions') : ''}
`;
        const mentions = [
            room.game.playerX,
            room.game.playerO,
            ...(winner ? [winner] : [room.game.currentTurn])
        ];
        await sock.sendMessage(room.x, {
            text: str,
            mentions
        });
        if (room.x !== room.o) {
            await sock.sendMessage(room.o, {
                text: str,
                mentions
            });
        }
        if (winner || isTie) {
            delete games[room.id];
        }
    }
    catch (error) {
        console.error('Error in tictactoe move:', error);
    }
}
export default {
    command: 'tictactoe',
    aliases: ['ttt', 'xo'],
    category: 'games',
    description: 'Play TicTacToe game with another user',
    usage: '.tictactoe [room name]',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const senderId = context.senderId || message.key.participant || message.key.remoteJid;
        const { t } = context;
        const text = args.join(' ').trim();
        try {
            if (Object.values(games).find((room) => room.id.startsWith('tictactoe') &&
                [room.game.playerX, room.game.playerO].includes(senderId))) {
                await sock.sendMessage(chatId, {
                    text: t('p.tictactoe.alreadyInGame')
                }, { quoted: message });
                return;
            }
            let room = Object.values(games).find((room) => room.state === 'WAITING' &&
                (text ? room.name === text : true));
            if (room) {
                room.o = chatId;
                room.game.playerO = senderId;
                room.state = 'PLAYING';
                const arr = room.game.render().map((v) => ({
                    'X': '❎',
                    'O': '⭕',
                    '1': '1️⃣',
                    '2': '2️⃣',
                    '3': '3️⃣',
                    '4': '4️⃣',
                    '5': '5️⃣',
                    '6': '6️⃣',
                    '7': '7️⃣',
                    '8': '8️⃣',
                    '9': '9️⃣',
                }[v] || v));
                const str = `
🎮 *${t('p.tictactoe.gameStarted')}*

${t('p.tictactoe.waitingForPlayer', { player: `@${room.game.currentTurn.split('@')[0]}` })}

${arr.slice(0, 3).join('')}
${arr.slice(3, 6).join('')}
${arr.slice(6).join('')}

▢ *${t('p.tictactoe.roomIdLabel')}:* ${room.id}
▢ *${t('p.tictactoe.rulesLabel')}:*
${t('p.tictactoe.rulesList')}
`;
                await sock.sendMessage(chatId, {
                    text: str,
                    mentions: [room.game.currentTurn, room.game.playerX, room.game.playerO]
                }, { quoted: message });
            }
            else {
                room = {
                    id: `tictactoe-${ +new Date}`,
                    x: chatId,
                    o: '',
                    game: new TicTacToe(senderId, 'o'),
                    state: 'WAITING'
                };
                if (text)
                    room.name = text;
                await sock.sendMessage(chatId, {
                    text: `*${t('p.tictactoe.waitingOpponent')}*\n\n${t('p.tictactoe.joinHint', { room: text || '' })}\n\n${t('p.tictactoe.playerLabel')} ❎: @${senderId.split('@')[0]}`,
                    mentions: [senderId]
                }, { quoted: message });
                games[room.id] = room;
            }
        }
        catch (error) {
            console.error('Error in tictactoe command:', error);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.tictactoe.startError')}`
            }, { quoted: message });
        }
    },
    handleTicTacToeMove,
    games
};
