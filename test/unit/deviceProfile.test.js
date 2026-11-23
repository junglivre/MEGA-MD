import { afterEach, describe, expect, it } from 'vitest';
import { generateLoginNode, generateRegistrationNode, proto } from '@whiskeysockets/baileys';
import { applyDeviceProfile } from '../../lib/deviceProfile.js';

const Platform = proto.ClientPayload.UserAgent.Platform;
const loginPlatform = (browser) =>
    generateLoginNode('5511999999999:3@s.whatsapp.net', { version: [2, 3000, 1], browser, countryCode: 'BR' }).userAgent.platform;

describe('applyDeviceProfile', () => {
    // The override is process-wide; leave the default behind for other tests.
    afterEach(() => applyDeviceProfile({ deviceType: 'desktop', whatsappType: 'normal' }));

    it('keeps the WhatsApp Web companion for desktop', () => {
        const { browser } = applyDeviceProfile({ deviceType: 'desktop', whatsappType: 'business' });
        expect(loginPlatform(browser)).toBe(Platform.WEB);
    });

    it('logs in as the regular Android app for a normal WhatsApp account', () => {
        const { browser } = applyDeviceProfile({ deviceType: 'mobile', whatsappType: 'normal' });
        expect(loginPlatform(browser)).toBe(Platform.ANDROID);
        expect(Platform.ANDROID).toBe(0);
    });

    it('logs in as Android WhatsApp Business for a Business account', () => {
        const { browser } = applyDeviceProfile({ deviceType: 'mobile', whatsappType: 'business' });
        expect(loginPlatform(browser)).toBe(10); // SMB_ANDROID
    });

    it('registers an Android phone companion when pairing as mobile', () => {
        const { browser } = applyDeviceProfile({ deviceType: 'mobile', whatsappType: 'business' });
        const node = generateRegistrationNode({
            registrationId: 1,
            signedPreKey: { keyId: 1, keyPair: { public: Buffer.alloc(32) }, signature: Buffer.alloc(64) },
            signedIdentityKey: { public: Buffer.alloc(32) }
        }, { version: [2, 3000, 1], browser, countryCode: 'BR', syncFullHistory: false });
        const props = proto.DeviceProps.decode(node.devicePairingData.deviceProps);
        expect(props.platformType).toBe(proto.DeviceProps.PlatformType.ANDROID_PHONE);
        expect(node.userAgent.platform).toBe(10);
        expect(node.webInfo).toBeFalsy();
    });

    it('switching back from business restores the regular Android platform', () => {
        applyDeviceProfile({ deviceType: 'mobile', whatsappType: 'business' });
        const { browser } = applyDeviceProfile({ deviceType: 'mobile', whatsappType: 'normal' });
        expect(loginPlatform(browser)).toBe(0);
    });
});
