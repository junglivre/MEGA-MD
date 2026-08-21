import axios from 'axios';
export default {
    command: 'whois',
    aliases: ['domaininfo'],
    category: 'info',
    description: 'Get WHOIS information of a domain',
    usage: '.whois <domain>',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        let domain = args?.[0]?.trim();
        if (!domain) {
            return await sock.sendMessage(chatId, { text: `*${t('p.whois.noDomain')}*\nExample: .whois google.com` }, { quoted: message });
        }
        domain = domain.replace(/^https?:\/\//i, '');
        try {
            if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.whois.invalidDomain')}` }, { quoted: message });
            }
            const apiUrl = `https://discardapi.dpdns.org/api/tools/whois?apikey=guru&domain=${encodeURIComponent(domain)}`;
            const { data } = await axios.get(apiUrl, { timeout: 10000 });
            if (!data?.status || !data.result?.domain) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.whois.fetchFailed')}` }, { quoted: message });
            }
            const { domain: dom, registrar, registrant, technical } = data.result;
            const na = t('p.whois.na');
            const text = `🌐 *${t('p.whois.title')}*\n\n` +
                `• ${t('p.whois.domain')}: ${dom.domain}\n` +
                `• ${t('p.whois.name')}: ${dom.name}\n` +
                `• ${t('p.whois.extension')}: .${dom.extension}\n` +
                `• ${t('p.whois.whoisServer')}: ${dom.whois_server}\n` +
                `• ${t('p.whois.status')}: ${dom.status.join(', ')}\n` +
                `• ${t('p.whois.nameServers')}: ${dom.name_servers.join(', ')}\n` +
                `• ${t('p.whois.created')}: ${dom.created_date_in_time}\n` +
                `• ${t('p.whois.updated')}: ${dom.updated_date_in_time}\n` +
                `• ${t('p.whois.expires')}: ${dom.expiration_date_in_time}\n\n` +
                `🏢 ${t('p.whois.registrar')}: ${registrar.name}\n` +
                `📞 ${t('p.whois.phone')}: ${registrar.phone}\n` +
                `📧 ${t('p.whois.email')}: ${registrar.email}\n` +
                `🔗 ${t('p.whois.website')}: ${registrar.referral_url}\n\n` +
                `👤 ${t('p.whois.registrant')}: ${registrant.organization || na}\n` +
                `🌍 ${t('p.whois.country')}: ${registrant.country || na}\n` +
                `📧 ${t('p.whois.email')}: ${registrant.email || na}\n\n` +
                `⚙ ${t('p.whois.technicalEmail')}: ${technical.email || na}`;
            await sock.sendMessage(chatId, { text }, { quoted: message });
        }
        catch (error) {
            console.error('WHOIS plugin error:', error);
            if (error.code === 'ECONNABORTED') {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.whois.timeout')}` }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.whois.failed')}` }, { quoted: message });
            }
        }
    }
};
