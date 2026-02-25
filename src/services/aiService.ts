import { supabase } from '../lib/supabase';
import { geminiService } from './geminiService';
import type { OnboardingData, FoodAnalysis, Profile, Modality, CommunityExercise } from '../types';

const callAiService = async (action: string, payload: any) => {
    const { data, error } = await supabase.functions.invoke('ai-service', {
        body: { action, payload }
    });
    if (error) throw error;
    return data;
};

export const aiService = {
    // Utility from GeminiService (pure logic)
    calculateCalorieGoal: geminiService.calculateCalorieGoal,

    async generateWorkoutPlan(data: OnboardingData & { active_days?: string[] }): Promise<any> {
        return await callAiService('GENERATE_WORKOUT', data);
    },

    async generateWorkoutSingleDay(profile: Partial<Profile>, dayName: string, availableMinutes: number, location: string, avoidExercises: string[] = []): Promise<any> {
        return await callAiService('GENERATE_WORKOUT_SINGLE', { profile, dayName, availableMinutes, location, avoidExercises });
    },

    async generateDietPlan(data: OnboardingData): Promise<any> {
        return await callAiService('GENERATE_DIET', data);
    },

    async analyzeBodyPhoto(base64: string, mimeType = 'image/jpeg'): Promise<string> {
        const result = await callAiService('ANALYZE_BODY', { base64, mimeType });
        return result.analysis || result;
    },

    async suggestUnits(food: string): Promise<string[]> {
        // Keeping it local or migrating? Let's migrate for consistency
        const result = await callAiService('SUGGEST_UNITS', { food });
        return result.units || [];
    },

    async suggestFoods(query: string): Promise<string[]> {
        const result = await callAiService('SUGGEST_FOODS', { query });
        return result.foods || [];
    },

    async analyzeFoodText(description: string): Promise<FoodAnalysis[]> {
        let aiResults: FoodAnalysis[] = [];
        try {
            const result = await callAiService('ANALYZE_FOOD_TEXT', { description });
            aiResults = result.items || [];
        } catch (e: any) {
            console.error('AI Service Error:', e);
            throw e;
        }

        const finalResults: FoodAnalysis[] = [];
        for (const item of aiResults) {
            // Check if this specific item exists in our database
            const { data: dbItem, error } = await supabase
                .from('food_database')
                .select('*')
                .ilike('name', item.description)
                .limit(1)
                .maybeSingle();

            if (dbItem && !error) {
                // Use database values if available
                finalResults.push({
                    description: dbItem.name,
                    calories: dbItem.calories,
                    protein: Number(dbItem.protein),
                    carbs: Number(dbItem.carbs),
                    fat: Number(dbItem.fat),
                    unit_weight: Number(dbItem.unit_weight || 100)
                });
            } else {
                // Item not in database. Save it to enrich the database
                if (item.calories > 0 || item.protein > 0 || item.carbs > 0 || item.fat > 0) {
                    try {
                        await supabase.from('food_database').insert({
                            name: item.description,
                            calories: item.calories,
                            protein: item.protein,
                            carbs: item.carbs,
                            fat: item.fat,
                            unit_weight: item.unit_weight || 100,
                            serving_size: '100g',
                            source: 'AI_Crowdsourced_v2'
                        });
                    } catch (dbErr) {
                        console.warn('Failed to crowdsource food item:', dbErr);
                    }
                }
                finalResults.push(item);
            }
        }
        return finalResults;
    },

    async analyzeFoodPhoto(base64: string, mimeType = 'image/jpeg'): Promise<FoodAnalysis> {
        const result = await callAiService('ANALYZE_FOOD_PHOTO', { base64, mimeType });
        return result.items?.[0] || result;
    },

    async analyzeFoodPhotoItems(base64: string, mimeType = 'image/jpeg'): Promise<FoodAnalysis[]> {
        const result = await callAiService('ANALYZE_FOOD_PHOTO', { base64, mimeType });
        return result.items || [];
    },

    async getAssistantResponse(userMessage: string, context: string): Promise<string> {
        const result = await callAiService('CHAT', { message: userMessage, context });
        return result.text || result;
    },

    async searchFoodDatabase(query: string): Promise<FoodAnalysis[]> {
        try {
            // Searched by name, which often includes brands like 'Nestlé', 'Sadia', etc.
            const { data, error } = await supabase
                .from('food_database')
                .select('*')
                .ilike('name', `%${query}%`)
                .limit(10);

            if (error || !data) return [];
            return data.map(item => ({
                description: item.name,
                calories: item.calories,
                protein: item.protein,
                carbs: item.carbs,
                fat: item.fat,
                unit_weight: item.unit_weight
            }));
        } catch (e) {
            console.error('Database search error', e);
            return [];
        }
    },


    async generateWorkoutFromTemplate(
        profile: Partial<Profile>,
        splitType: string,
        activeDays: string[],
        location: string
    ): Promise<any> {
        return await callAiService('GENERATE_WORKOUT', {
            ...profile,
            training_location: location,
            active_days: activeDays,
            split_type: splitType,
        });
    },

    async generateCardioPlan(
        profile: Partial<Profile>,
        cardioType: string,
        activeDays: string[],
        goalMinutes: number
    ): Promise<any> {
        return await callAiService('GENERATE_CARDIO_PLAN', {
            profile,
            cardioType,
            activeDays,
            goalMinutes,
        });
    },

    async generateModalityPlan(
        profile: Partial<Profile>,
        modality: Modality
    ): Promise<any> {
        return await callAiService('GENERATE_MODALITY_PLAN', {
            profile,
            modality,
        });
    },

    async generateModalityExercises(
        modality: Pick<Modality, 'name' | 'description'>,
        count = 6
    ): Promise<CommunityExercise[]> {
        try {
            const result = await callAiService('GENERATE_MODALITY_EXERCISES', {
                modality,
                count,
            });
            return result.exercises ?? [];
        } catch {
            return [];
        }
    },

    async generateExerciseInstructions(
        exerciseName: string,
        category: string,
        modalityName?: string
    ): Promise<string> {
        try {
            const result = await callAiService('GENERATE_EXERCISE_INSTRUCTIONS', {
                exerciseName,
                category,
                modalityName,
            });
            return result.instructions ?? '';
        } catch {
            return '';
        }
    },

    async fetchFromOpenFoodFacts(barcode: string): Promise<FoodAnalysis | null> {
        try {
            const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
            const data = await res.json();
            if (data.status === 1 && data.product) {
                const p = data.product;
                const nutrients = p.nutriments;
                return {
                    description: p.product_name || 'Produto desconhecido',
                    calories: Math.round(nutrients['energy-kcal_100g'] || nutrients['energy_100g'] / 4.184 || 0),
                    protein: Math.round(nutrients.proteins_100g || 0),
                    carbs: Math.round(nutrients.carbohydrates_100g || 0),
                    fat: Math.round(nutrients.fat_100g || 0)
                };
            }
            return null;
        } catch (e) {
            console.error('OpenFoodFacts error', e);
            return null;
        }
    }
};
