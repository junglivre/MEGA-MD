import { beforeEach, describe, expect, it, vi } from 'vitest';

const settings = new Map();

vi.mock('../../lib/lightweight_store.js', () => ({
    default: {
        getSetting: vi.fn(async (_scope, key) => settings.get(key) ?? null),
        saveSetting: vi.fn(async (_scope, key, value) => settings.set(key, value))
    }
}));

vi.mock('../../config.js', () => ({
    default: {
        ownerNumber: '5511999999999',
        defaultLanguage: 'pt-BR'
    }
}));

vi.mock('../../lib/i18n.js', () => ({
    createTranslator: () => (key) => key
}));

vi.mock('../../lib/isOwner.js', () => ({
    cleanJid: (jid) => String(jid || '').split(':')[0].split('@')[0]
}));

describe('yt-dlp cookie expiration alerts', () => {
    beforeEach(() => {
        settings.clear();
        vi.clearAllMocks();
    });

    it.each([
        ['English anti-bot challenge', "ERROR: [youtube] Sign in to confirm you're not a bot. Use --cookies-from-browser or --cookies for the authentication."],
        ['Portuguese anti-bot challenge', 'ERROR: [youtube] Faça login para confirmar que você não é um bot.'],
        ['Spanish anti-bot challenge', 'ERROR: [youtube] Inicia sesión para confirmar que no eres un bot.'],
        ['login requirement', 'ERROR: [youtube] LOGIN_REQUIRED'],
        ['page reload failure', 'ERROR: [youtube] The page needs to be reloaded.'],
        ['HTTP rejection', 'ERROR: unable to download video data: HTTP Error 403: Forbidden']
    ])('does not invalidate or alert for %s', async (_name, stderr) => {
        const { cookieManager: manager } = await import('../../lib/ytdlp.js');
        const { default: store } = await import('../../lib/lightweight_store.js');
        await manager.saveCookiesSetting('.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tvalue');
        const before = structuredClone(settings.get('youtubeCookies'));
        store.saveSetting.mockClear();
        const sock = {
            onWhatsApp: vi.fn().mockResolvedValue([{ exists: true, jid: '5511999999999@s.whatsapp.net' }]),
            sendMessage: vi.fn()
        };

        await manager.checkInvalid({ label: 'default' }, stderr, sock);

        expect(settings.get('youtubeCookies')).toEqual(before);
        expect(store.saveSetting).not.toHaveBeenCalled();
        expect(sock.onWhatsApp).not.toHaveBeenCalled();
        expect(sock.sendMessage).not.toHaveBeenCalled();
    });

    it('sends an expiration alert to the verified owner before recording its cooldown', async () => {
        const { cookieManager: manager } = await import('../../lib/ytdlp.js');
        await manager.saveCookiesSetting('.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tvalue');
        const sock = {
            onWhatsApp: vi.fn().mockResolvedValue([{ exists: true, jid: '5511999999999@s.whatsapp.net' }]),
            sendMessage: vi.fn().mockResolvedValue({ key: { id: 'alert-id' } })
        };

        await manager.checkInvalid({ label: 'default' }, 'WARNING: The provided YouTube account cookies are no longer valid. They have likely been rotated in the browser as a security measure.', sock);

        expect(sock.onWhatsApp).toHaveBeenCalledWith('5511999999999@s.whatsapp.net');
        expect(sock.sendMessage).toHaveBeenCalledWith(
            '5511999999999@s.whatsapp.net',
            { text: 'p.dlcookies.invalidAlert' }
        );
        const [profile] = settings.get('youtubeCookies');
        expect(profile.invalid).toBe(true);
        expect(profile.invalidAt).toEqual(expect.any(Number));
        expect(profile.lastAlertAt).toEqual(expect.any(Number));

        const afterAlert = structuredClone(settings.get('youtubeCookies'));
        await manager.checkInvalid({ label: 'default' }, 'WARNING: The provided YouTube account cookies are no longer valid.', sock);

        expect(settings.get('youtubeCookies')).toEqual(afterAlert);
        expect(sock.onWhatsApp).toHaveBeenCalledOnce();
        expect(sock.sendMessage).toHaveBeenCalledOnce();
    });

    it('does not start the cooldown when owner delivery cannot be accepted', async () => {
        const { cookieManager: manager } = await import('../../lib/ytdlp.js');
        await manager.saveCookiesSetting('.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tvalue');
        const sock = {
            onWhatsApp: vi.fn().mockResolvedValue([{ exists: true, jid: '5511999999999@s.whatsapp.net' }]),
            sendMessage: vi.fn().mockRejectedValue(new Error('temporary send failure'))
        };

        await manager.checkInvalid({ label: 'default' }, 'WARNING: The provided YouTube account cookies are no longer valid.', sock);

        expect(sock.sendMessage).toHaveBeenCalledOnce();
        const [profile] = settings.get('youtubeCookies');
        expect(profile.invalid).toBe(true);
        expect(profile.lastAlertAt).toBeNull();
    });

    it('does not send to an unregistered configured owner number', async () => {
        const { cookieManager: manager } = await import('../../lib/ytdlp.js');
        await manager.saveCookiesSetting('.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tvalue');
        const sock = {
            onWhatsApp: vi.fn().mockResolvedValue([{ exists: false }]),
            sendMessage: vi.fn()
        };

        await manager.checkInvalid({ label: 'default' }, 'WARNING: The provided YouTube account cookies are no longer valid.', sock);

        expect(sock.sendMessage).not.toHaveBeenCalled();
        const [profile] = settings.get('youtubeCookies');
        expect(profile.invalid).toBe(true);
        expect(profile.lastAlertAt).toBeNull();
    });
});
