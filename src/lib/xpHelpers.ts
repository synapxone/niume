import { supabase } from './supabase';

export async function calculateEvolutionXP(userId: string): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
        // Workouts logged in the last 30 days
        const { count: workoutCount, error: workoutErr } = await supabase
            .from('workout_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('session_date', thirtyDaysAgo);

        // Nutrition logged in the last 30 days
        const { data: nutritionData, error: nutErr } = await supabase
            .from('daily_nutrition')
            .select('total_calories, goal_calories')
            .eq('user_id', userId)
            .gte('date', thirtyDaysAgo);

        let xp = 25; // Base participation XP

        if (workoutCount && !workoutErr) {
            xp += workoutCount * 25; // 25 XP per workout session in the month
        }

        if (nutritionData && !nutErr) {
            let goodDietDays = 0;
            for (const day of nutritionData) {
                // Count a day as "good" if within -300 to +100 cals of goal
                if (day.total_calories > day.goal_calories * 0.5 && day.total_calories <= day.goal_calories + 200) {
                    goodDietDays++;
                }
            }
            xp += goodDietDays * 15; // 15 XP per good diet day
        }

        // Return minimum of 25, or calculated value
        return Math.max(25, xp);
    } catch (error) {
        console.error('Error calculating XP:', error);
        return 25; // Fallback
    }
}
