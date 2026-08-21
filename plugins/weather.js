import axios from 'axios';
import { channelInfo } from '../lib/messageConfig.js';
export default {
    command: 'weather',
    aliases: ['forecast', 'climate'],
    category: 'info',
    description: 'Get the current weather for a specific city!',
    usage: '.weather <city>',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        const city = args.join(' ').trim();
        if (!city) {
            return await sock.sendMessage(chatId, {
                text: `*${t('p.weather.noCity')}*\n${t('p.weather.example')}`,
                ...channelInfo
            }, { quoted: message });
        }
        try {
            const apiKey = '060a6bcfa19809c2cd4d97a212b19273';
            const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`);
            const weather = response.data;
            const weatherText = `${t('p.weather.title')}\n\n` +
                `「 🌅 」${t('p.weather.place')}: ${weather.name}\n` +
                `「 🗺️ 」${t('p.weather.country')}: ${weather.sys.country}\n` +
                `「 🌤️ 」${t('p.weather.view')}: ${weather.weather[0].description}\n` +
                `「 🌡️ 」${t('p.weather.temperature')}: ${weather.main.temp}°C\n` +
                `「 💠 」${t('p.weather.minTemp')}: ${weather.main.temp_min}°C\n` +
                `「 🔥 」${t('p.weather.maxTemp')}: ${weather.main.temp_max}°C\n` +
                `「 💦 」${t('p.weather.humidity')}: ${weather.main.humidity}%\n` +
                `「 🌬️ 」${t('p.weather.windSpeed')}: ${weather.wind.speed} km/h`;
            await sock.sendMessage(chatId, {
                text: weatherText,
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            console.error('Weather plugin error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.weather.failed')}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
