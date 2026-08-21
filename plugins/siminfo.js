import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
const execAsync = promisify(exec);
export default {
    command: 'siminfo',
    aliases: ['phoneinfo', 'numinfo', 'carrier', 'phinfo'],
    category: 'utility',
    description: 'Lookup phone number country, carrier and type',
    usage: '.siminfo <phone number with country code>\nExample: .siminfo +923001234567',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        const input = args.join('').trim().replace(/\s+/g, '');
        if (!input) {
            return await sock.sendMessage(chatId, {
                text: t('p.siminfo.usage'),
                ...channelInfo
            }, { quoted: message });
        }
        try {
            const scriptPath = path.join(process.cwd(), 'lib', 'siminfo.py');
            const { stdout } = await execAsync(`python3 "${scriptPath}" "${input}"`, { timeout: 10000 });
            const data = JSON.parse(stdout.trim());
            if (data.error) {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${data.error}`,
                    ...channelInfo
                }, { quoted: message });
            }
            const validIcon = data.valid ? '✅' : '⚠️';
            const validText = data.valid ? t('p.siminfo.valid') : t('p.siminfo.invalid');
            const carrierLine = data.carrier !== 'Unknown' ? `\n📶 *${t('p.siminfo.carrier')}:* ${data.carrier}` : '';
            await sock.sendMessage(chatId, {
                text: t('p.siminfo.result', {
                    number: data.number,
                    flag: data.flag,
                    country: data.country,
                    region: data.region,
                    countryCode: data.country_code,
                    nationalNumber: data.national_number,
                    lineType: data.line_type,
                    carrierLine,
                    validIcon,
                    validText
                }),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            await sock.sendMessage(chatId, {
                text: t('p.siminfo.lookupFailed', { error: error.message }),
                ...channelInfo
            }, { quoted: message });
        }
    }
};
