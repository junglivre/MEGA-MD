import axios from 'axios';
const triviaGames = {};
export default {
    command: 'trivia',
    aliases: ['quiz'],
    category: 'games',
    description: 'Start a trivia game or answer the question',
    usage: '.trivia [answer]',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        if (args.length === 0) {
            if (triviaGames[chatId]) {
                await sock.sendMessage(chatId, {
                    text: t('p.trivia.alreadyInProgress'),
                    ...channelInfo
                }, { quoted: message });
                return;
            }
            try {
                const response = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple');
                const questionData = response.data.results[0];
                triviaGames[chatId] = {
                    question: questionData.question,
                    correctAnswer: questionData.correct_answer,
                    options: [...questionData.incorrect_answers, questionData.correct_answer].sort(),
                };
                await sock.sendMessage(chatId, {
                    text: `🎯 *${t('p.trivia.title')}*\n\n*${t('p.trivia.questionLabel')}:* ${triviaGames[chatId].question}\n\n*${t('p.trivia.optionsLabel')}:*\n${triviaGames[chatId].options.join('\n')}\n\n${t('p.trivia.answerHint')}`,
                    ...channelInfo
                }, { quoted: message });
            }
            catch (error) {
                await sock.sendMessage(chatId, {
                    text: t('p.trivia.fetchError'),
                    ...channelInfo
                }, { quoted: message });
            }
        }
        else {
            if (!triviaGames[chatId]) {
                await sock.sendMessage(chatId, {
                    text: t('p.trivia.noGame'),
                    ...channelInfo
                }, { quoted: message });
                return;
            }
            const game = triviaGames[chatId];
            const answer = args.join(' ');
            if (answer.toLowerCase() === game.correctAnswer.toLowerCase()) {
                await sock.sendMessage(chatId, {
                    text: `✅ ${t('p.trivia.correct', { answer: game.correctAnswer })}`,
                    ...channelInfo
                }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.trivia.wrong', { answer: game.correctAnswer })}`,
                    ...channelInfo
                }, { quoted: message });
            }
            delete triviaGames[chatId];
        }
    }
};
