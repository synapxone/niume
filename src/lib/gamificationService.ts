import { supabase } from './supabase';
import { POINTS, xpForLevel } from '../types';

export const gamificationService = {
    async awardPoints(userId: string, action: keyof typeof POINTS | number, multiplier: number = 1): Promise<{ pointsEarned: number; leveledUp: boolean }> {
        const pointsToAdd = typeof action === 'number' ? action : POINTS[action] * multiplier;

        // 1. Get current gamification state
        const { data: current, error: getErr } = await supabase
            .from('gamification')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (getErr || !current) {
            console.error('Gamification record not found for user', userId);
            return { pointsEarned: 0, leveledUp: false };
        }

        let { points, level, total_workouts, total_meals_logged, streak_days, last_activity_date } = current;

        // 2. Update totals based on action type
        if (action === 'WORKOUT_COMPLETE' || action === 'WORKOUT_PARTIAL') {
            total_workouts += 1;
        } else if (action === 'MEAL_LOGGED') {
            total_meals_logged += multiplier;
        } else if (typeof action === 'number' && multiplier > 1) {
            total_meals_logged += multiplier;
        }

        // 3. Update Streak
        const today = new Date().toISOString().split('T')[0];
        const lastDate = last_activity_date ? new Date(last_activity_date).toISOString().split('T')[0] : null;

        if (lastDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (lastDate === yesterdayStr) {
                streak_days += 1;
            } else if (lastDate !== today) {
                streak_days = 1;
            }
            last_activity_date = new Date().toISOString();
        }

        // 4. Update Points and XP
        let newPoints = points + pointsToAdd;
        let newLevel = level;
        let leveledUp = false;

        // Level up logic
        let xpNeeded = xpForLevel(newLevel);
        while (newPoints >= (newLevel * xpNeeded)) { // Simple leveling logic based on types.ts
            // Actually points % xpForLevel(level) is the progress.
            // Let's stick to a simpler logic: every level takes more points.
            // The XP bar in UI uses: (points % xpForThis) / xpForThis
            // So level depends on total points.
            // Actually, the UI suggests: Level = points / threshold? 
            // No, types.ts says level N needs N * 200 XP.
            // Let's implement a proper cumulative level calculation.

            let cumulativeRequired = 0;
            for (let i = 1; i <= newLevel; i++) cumulativeRequired += xpForLevel(i);

            if (newPoints >= cumulativeRequired + xpForLevel(newLevel + 1)) {
                newLevel++;
                leveledUp = true;
            } else {
                break;
            }
        }

        // 5. Save back to DB
        const { error: updateErr } = await supabase
            .from('gamification')
            .update({
                points: newPoints,
                level: newLevel,
                streak_days,
                total_workouts,
                total_meals_logged,
                last_activity_date: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (updateErr) {
            console.error('Error updating gamification', updateErr);
            return { pointsEarned: 0, leveledUp: false };
        }

        return { pointsEarned: pointsToAdd, leveledUp };
    }
};
