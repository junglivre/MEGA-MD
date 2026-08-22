import config from '../config.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1';

function hideReasoning(text) {
    return String(text || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/^\s*<think>[\s\S]*$/i, '')
        .replace(/^\s*<\/think>\s*/i, '')
        .trim();
}

function getConfig() {
    return {
        apiKey: process.env.GROQ_API_KEY || '',
        chatModel: config.groqChatModel,
        visionModel: config.groqVisionModel,
        transcriptionModel: config.groqTranscriptionModel,
        chatMaxTokens: config.groqChatMaxTokens,
        chatTemperature: config.groqChatTemperature
    };
}

async function groqRequest(endpoint, body, headers = {}) {
    const { apiKey } = getConfig();
    if (!apiKey)
        return null;
    const response = await fetch(`${GROQ_API_URL}${endpoint}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, ...headers },
        body
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Groq ${response.status}: ${detail.slice(0, 300)}`);
    }
    return response;
}

export async function groqChat(messages, options = {}) {
    const { chatModel, chatTemperature, chatMaxTokens } = getConfig();
    const response = await groqRequest('/chat/completions', JSON.stringify({
        model: options.model || chatModel,
        messages,
        temperature: options.temperature ?? chatTemperature,
        max_tokens: options.maxTokens || chatMaxTokens
    }), { 'content-type': 'application/json' });
    if (!response)
        return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
}

export async function groqTranscribe(buffer, filename = 'audio.ogg', mimetype = 'audio/ogg', options = {}) {
    const { transcriptionModel } = getConfig();
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimetype }), filename);
    form.append('model', options.model || transcriptionModel);
    form.append('response_format', 'json');
    if (options.language)
        form.append('language', options.language);
    const response = await groqRequest('/audio/transcriptions', form);
    if (!response)
        return null;
    const data = await response.json();
    return data.text?.trim() || null;
}

export async function groqVision(buffer, mimetype = 'image/jpeg', prompt, options = {}) {
    const { visionModel } = getConfig();
    const imageType = mimetype || 'image/jpeg';
    const imageData = `data:${imageType};base64,${Buffer.from(buffer).toString('base64')}`;
    const response = await groqRequest('/chat/completions', JSON.stringify({
        model: options.model || visionModel,
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageData } }
            ]
        }],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens || 700,
        reasoning_format: 'hidden',
        reasoning_effort: 'none'
    }), { 'content-type': 'application/json' });
    if (!response)
        return null;
    const data = await response.json();
    return hideReasoning(data.choices?.[0]?.message?.content) || null;
}

export function hasGroqKey() {
    return Boolean(process.env.GROQ_API_KEY);
}
