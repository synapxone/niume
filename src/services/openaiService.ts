import type { OnboardingData, FoodAnalysis, Profile } from '../types';

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const BASE_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

async function callOpenAI(prompt: string, json = true, timeoutMs = 60000, maxTokens = 4000): Promise<string> {
    if (!API_KEY) throw new Error('OPENAI_KEY_MISSING');

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: maxTokens,
                ...(json ? { response_format: { type: "json_object" } } : {})
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            if (res.status === 429) throw new Error('QUOTA_EXCEEDED');
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
    } finally {
        clearTimeout(id);
    }
}

async function callOpenAIVision(base64Data: string, mimeType: string, prompt: string, timeoutMs = 60000): Promise<string> {
    if (!API_KEY) throw new Error('OPENAI_KEY_MISSING');

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${mimeType};base64,${base64Data}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1000,
                response_format: { type: "json_object" }
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            if (res.status === 429) throw new Error('QUOTA_EXCEEDED');
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
    } finally {
        clearTimeout(id);
    }
}

export const openaiService = {
    async generateWorkoutPlan(data: OnboardingData & { active_days?: string[] }): Promise<any> {
        const prompt = `Crie um plano de treino JSON (4 semanas). Perfil: Objetivo ${data.goal}, Local ${data.training_location}, Tempo ${data.available_minutes}min.
        Retorne no formato JSON: { "name": "...", "weeks": [...] }`;
        const text = await callOpenAI(prompt);
        return JSON.parse(text);
    },

    async generateWorkoutSingleDay(profile: Partial<Profile>, dayName: string, availableMinutes: number, location: string, avoidExercises: string[] = []): Promise<any> {
        const prompt = `Gere um treino JSON para o dia ${dayName}. Perfil: ${profile.goal}, ${location}, ${availableMinutes}min. 
        Evite: ${avoidExercises.join(', ')}. Format: { "day": 1, "name": "...", "type": "strength", "exercises": [...] }`;
        const text = await callOpenAI(prompt);
        return JSON.parse(text);
    },

    async generateDietPlan(data: OnboardingData): Promise<any> {
        const prompt = `Gere um plano alimentar JSON. Perfil: ${data.goal}, Peso ${data.weight}kg.
        Format: { "daily_calories": 2000, "macros": {...}, "meals": [...] }`;
        const text = await callOpenAI(prompt);
        return JSON.parse(text);
    },

    async analyzeBodyPhoto(base64: string, mimeType = 'image/jpeg'): Promise<string> {
        const prompt = `Analise esta foto corporal. Retorne um JSON: { "analysis": "texto da análise em português brasileiro" }`;
        const text = await callOpenAIVision(base64, mimeType, prompt);
        const parsed = JSON.parse(text);
        return parsed.analysis;
    },

    async suggestUnits(food: string): Promise<string[]> {
        const prompt = `Sugira unidades de medida para "${food}". JSON format: { "units": ["unidade", "gramas"] }`;
        const text = await callOpenAI(prompt);
        const parsed = JSON.parse(text);
        return parsed.units || [];
    },

    async suggestFoods(query: string): Promise<string[]> {
        const prompt = `Sugira variações de "${query}". JSON format: { "foods": ["var1", "var2"] }`;
        const text = await callOpenAI(prompt);
        const parsed = JSON.parse(text);
        return parsed.foods || [];
    },

    async analyzeFoodText(description: string): Promise<FoodAnalysis> {
        const prompt = `Analise nutricionalmente: "${description}". JSON format: { "description": "...", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }`;
        const text = await callOpenAI(prompt);
        return JSON.parse(text);
    },

    async analyzeFoodPhoto(base64: string, mimeType = 'image/jpeg'): Promise<FoodAnalysis> {
        const prompt = `Identifique o alimento e macros. JSON format: { "description": "...", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }`;
        const text = await callOpenAIVision(base64, mimeType, prompt);
        return JSON.parse(text);
    },

    async analyzeFoodPhotoItems(base64: string, mimeType = 'image/jpeg'): Promise<FoodAnalysis[]> {
        const prompt = `Identifique TODOS os itens e macros. JSON format: { "items": [{ "description": "...", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }] }`;
        const text = await callOpenAIVision(base64, mimeType, prompt);
        const parsed = JSON.parse(text);
        return parsed.items || [];
    },

    async getAssistantResponse(userMessage: string, context: string): Promise<string> {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 60000);
        try {
            const res = await fetch(BASE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: MODEL,
                    messages: [
                        { role: 'system', content: 'Você é o assistente "Pers". Responda em português brasileiro de forma motivadora e curta.' },
                        { role: 'user', content: `Contexto: ${context}\n\nMensagem: ${userMessage}` }
                    ],
                    temperature: 0.7,
                }),
                signal: controller.signal,
            });
            const data = await res.json();
            return data.choices?.[0]?.message?.content || 'Desculpe, tive um problema.';
        } finally {
            clearTimeout(id);
        }
    }
};
