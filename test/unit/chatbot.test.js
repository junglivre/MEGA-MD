import { describe, expect, it } from 'vitest';
import { getChatbotState, isReplyToCommandResponse } from '../../plugins/chatbot.js';

function replyToBotResponse(botResponse) {
    return {
        message: {
            extendedTextMessage: {
                text: 'comentário',
                contextInfo: {
                    participant: '5511999999999@s.whatsapp.net',
                    quotedMessage: botResponse
                }
            }
        }
    };
}

describe('chatbot command reply settings', () => {
    it('keeps the current behavior for legacy boolean settings', () => {
        expect(getChatbotState(true)).toEqual({
            enabled: true,
            replyToCommandResponses: true
        });
    });

    it('persists disabled chatbot options without enabling the chatbot', () => {
        expect(getChatbotState({ enabled: false, replyToCommandResponses: false })).toEqual({
            enabled: false,
            replyToCommandResponses: false
        });
    });

    it('recognizes replies to sticker command results', () => {
        const message = replyToBotResponse({
            stickerMessage: {}
        });
        expect(isReplyToCommandResponse(message, ['.'])).toBe(true);
    });

    it('recognizes replies to image command results such as Last.fm cards', () => {
        const message = replyToBotResponse({
            imageMessage: {}
        });
        expect(isReplyToCommandResponse(message, ['.'])).toBe(true);
    });

    it('recognizes text command results through their quoted command', () => {
        const message = replyToBotResponse({
            extendedTextMessage: {
                text: 'Pong!',
                contextInfo: {
                    quotedMessage: { conversation: '.ping' }
                }
            }
        });
        expect(isReplyToCommandResponse(message, ['.'])).toBe(true);
    });

    it('does not confuse a chatbot conversation with a command result', () => {
        const message = replyToBotResponse({
            extendedTextMessage: {
                text: 'Resposta do chatbot',
                contextInfo: {
                    quotedMessage: { extendedTextMessage: { text: '@bot tudo bem?' } }
                }
            }
        });
        expect(isReplyToCommandResponse(message, ['.'])).toBe(false);
    });
});
