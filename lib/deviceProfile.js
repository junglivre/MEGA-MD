// Which kind of companion device the bot registers as (DEVICE_TYPE / WHATSAPP_TYPE).
//
// 'desktop' is the classic WhatsApp Web companion. WhatsApp withholds view-once
// media from it: the message arrives as a stub, or with no mediaKey/directPath.
// 'mobile' registers as an Android companion phone, which does receive
// view-once media with its download key (confirmed on production 2026-11-23).
//
// Baileys only knows the regular Android app: any browser whose second field
// contains "android" logs in with UserAgent platform ANDROID. A WhatsApp
// Business account refuses that ("You can only link to another WhatsApp
// Business app"), and Baileys has no option for SMB_ANDROID. Its login payload
// reads proto...Platform.ANDROID at call time, so for Business we point that
// enum entry at SMB_ANDROID before connecting. assertLoginPlatform() checks the
// payload Baileys actually builds, so a Baileys upgrade that changes this path
// fails at startup instead of silently pairing as the wrong app.
import { Browsers, generateLoginNode, proto } from '@whiskeysockets/baileys';

const Platform = proto.ClientPayload.UserAgent.Platform;
const ORIGINAL_ANDROID = Platform.ANDROID;

function assertLoginPlatform(browser, expected) {
    const payload = generateLoginNode('0:1@s.whatsapp.net', { version: [2, 3000, 1], browser, countryCode: 'US' });
    if (payload.userAgent?.platform !== expected)
        throw new Error(`Baileys login platform is ${payload.userAgent?.platform}, expected ${expected}; the device profile override no longer applies to this Baileys version`);
}

/**
 * @param {{deviceType: 'desktop'|'mobile', whatsappType: 'normal'|'business'}} options
 * @returns {{browser: string[], label: string}}
 */
export function applyDeviceProfile({ deviceType, whatsappType }) {
    const business = deviceType === 'mobile' && whatsappType === 'business';
    Platform.ANDROID = business ? Platform.SMB_ANDROID : ORIGINAL_ANDROID;
    if (deviceType !== 'mobile') {
        const browser = Browsers.macOS('Chrome');
        assertLoginPlatform(browser, Platform.WEB);
        return { browser, label: 'desktop (WhatsApp Web)' };
    }
    const browser = Browsers.android('Android');
    assertLoginPlatform(browser, business ? Platform.SMB_ANDROID : ORIGINAL_ANDROID);
    return { browser, label: business ? 'mobile (Android, WhatsApp Business)' : 'mobile (Android, WhatsApp)' };
}
