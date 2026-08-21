import axios from 'axios';
export default {
    command: 'medicine',
    aliases: ['drug', 'medinfo', 'druginfo', 'med'],
    category: 'info',
    description: 'Get medicine/drug info: uses, side effects, warnings',
    usage: '.medicine aspirin\n.medicine paracetamol',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        const query = args.join(' ').trim();
        if (!query) {
            return await sock.sendMessage(chatId, {
                text: `💊 *${t('p.medicine.title')}*\n\n` +
                    `*${t('p.medicine.usageLabel')}:* \`.medicine <name>\`\n\n` +
                    `*${t('p.medicine.examplesLabel')}:*\n` +
                    `• \`.medicine aspirin\`\n` +
                    `• \`.medicine paracetamol\`\n` +
                    `• \`.medicine amoxicillin\`\n` +
                    `• \`.medicine ibuprofen\`\n` +
                    `• \`.medicine metformin\`\n\n` +
                    `⚠️ _${t('p.medicine.disclaimer')}_`,
                ...channelInfo
            }, { quoted: message });
        }
        await sock.sendMessage(chatId, { text: `🔍 ${t('p.medicine.lookingUp', { query })}`, ...channelInfo }, { quoted: message });
        try {
            const res = await axios.get(`https://api.fda.gov/drug/label.json?search=${encodeURIComponent(query)}&limit=1`, { timeout: 15000 });
            const result = res.data.results?.[0];
            if (!result) {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.medicine.notFound', { query })}\n\n${t('p.medicine.tryGeneric')}`,
                    ...channelInfo
                }, { quoted: message });
            }
            const openfda = result.openfda || {};
            const brandName = openfda.brand_name?.[0] || query;
            const genericName = openfda.generic_name?.[0] || 'N/A';
            const manufacturer = openfda.manufacturer_name?.[0] || 'N/A';
            const route = openfda.route?.[0] || 'N/A';
            const substanceName = openfda.substance_name?.[0] || 'N/A';
            const clean = (text, maxLen = 400) => {
                if (!text)
                    return 'N/A';
                const str = Array.isArray(text) ? text[0] : text;
                const cleaned = str.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
                return cleaned.length > maxLen ? `${cleaned.substring(0, maxLen) }...` : cleaned;
            };
            const purpose = clean(result.purpose, 300);
            const indications = clean(result.indications_and_usage, 400);
            const warnings = clean(result.warnings, 400);
            const sideEffects = clean(result.adverse_reactions, 400);
            const dosage = clean(result.dosage_and_administration, 300);
            const storage = clean(result.storage_and_handling, 200);
            let text = `💊 *${brandName}*\n`;
            if (genericName !== 'N/A')
                text += `_(${genericName})_\n`;
            text += `\n`;
            if (substanceName !== 'N/A')
                text += `🧪 *${t('p.medicine.activeSubstanceLabel')}:* ${substanceName}\n`;
            text += `🏭 *${t('p.medicine.manufacturerLabel')}:* ${manufacturer}\n`;
            text += `💉 *${t('p.medicine.routeLabel')}:* ${route}\n\n`;
            if (purpose !== 'N/A')
                text += `🎯 *${t('p.medicine.purposeLabel')}:*\n${purpose}\n\n`;
            if (indications !== 'N/A')
                text += `✅ *${t('p.medicine.usesLabel')}:*\n${indications}\n\n`;
            if (dosage !== 'N/A')
                text += `📏 *${t('p.medicine.dosageLabel')}:*\n${dosage}\n\n`;
            if (warnings !== 'N/A')
                text += `⚠️ *${t('p.medicine.warningsLabel')}:*\n${warnings}\n\n`;
            if (sideEffects !== 'N/A')
                text += `🔴 *${t('p.medicine.sideEffectsLabel')}:*\n${sideEffects}\n\n`;
            if (storage !== 'N/A')
                text += `📦 *${t('p.medicine.storageLabel')}:* ${storage}\n\n`;
            text += `⚕️ _${t('p.medicine.finalDisclaimer')}_`;
            await sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });
        }
        catch (error) {
            if (error.response?.status === 404) {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.medicine.medNotFound', { query })}\n\n${t('p.medicine.tryScientific')}`,
                    ...channelInfo
                }, { quoted: message });
            }
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.medicine.failed', { message: error.message })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
