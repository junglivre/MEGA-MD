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

function youtubeCookieManager(createCookieManager) {
    return createCookieManager({
        site: 'youtube',
        siteLabel: 'YouTube',
        envVar: 'YOUTUBE_COOKIES_FILE',
        domainPattern: /youtube\.com$/,
        invalidPattern: /login required/i
    });
}

describe('yt-dlp cookie expiration alerts', () => {
    beforeEach(() => {
        settings.clear();
        vi.clearAllMocks();
    });

    it('sends an expiration alert to the verified owner before recording its cooldown', async () => {
        const { createCookieManager } = await import('../../lib/ytdlpCore.js');
        const manager = youtubeCookieManager(createCookieManager);
        await manager.saveCookiesSetting('.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tvalue');
        const sock = {
            onWhatsApp: vi.fn().mockResolvedValue([{ exists: true, jid: '5511999999999@s.whatsapp.net' }]),
            sendMessage: vi.fn().mockResolvedValue({ key: { id: 'alert-id' } })
        };

        await manager.checkInvalid({ label: 'default' }, 'ERROR: Login required', sock);

        expect(sock.onWhatsApp).toHaveBeenCalledWith('5511999999999@s.whatsapp.net');
        expect(sock.sendMessage).toHaveBeenCalledWith(
            '5511999999999@s.whatsapp.net',
            { text: 'p.dlcookies.invalidAlert' }
        );
        const [profile] = settings.get('youtubeCookies');
        expect(profile.invalid).toBe(true);
        expect(profile.invalidAt).toEqual(expect.any(Number));
        expect(profile.lastAlertAt).toEqual(expect.any(Number));
    });

    it('does not start the cooldown when owner delivery cannot be accepted', async () => {
        const { createCookieManager } = await import('../../lib/ytdlpCore.js');
        const manager = youtubeCookieManager(createCookieManager);
        await manager.saveCookiesSetting('.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tvalue');
        const sock = {
            onWhatsApp: vi.fn().mockResolvedValue([{ exists: true, jid: '5511999999999@s.whatsapp.net' }]),
            sendMessage: vi.fn().mockRejectedValue(new Error('temporary send failure'))
        };

        await manager.checkInvalid({ label: 'default' }, 'ERROR: Login required', sock);

        expect(sock.sendMessage).toHaveBeenCalledOnce();
        const [profile] = settings.get('youtubeCookies');
        expect(profile.invalid).toBe(true);
        expect(profile.lastAlertAt).toBeNull();
    });

    it('does not send to an unregistered configured owner number', async () => {
        const { createCookieManager } = await import('../../lib/ytdlpCore.js');
        const manager = youtubeCookieManager(createCookieManager);
        await manager.saveCookiesSetting('.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tvalue');
        const sock = {
            onWhatsApp: vi.fn().mockResolvedValue([{ exists: false }]),
            sendMessage: vi.fn()
        };

        await manager.checkInvalid({ label: 'default' }, 'ERROR: Login required', sock);

        expect(sock.sendMessage).not.toHaveBeenCalled();
        const [profile] = settings.get('youtubeCookies');
        expect(profile.invalid).toBe(true);
        expect(profile.lastAlertAt).toBeNull();
    });
});
