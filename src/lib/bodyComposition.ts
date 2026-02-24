import type { Gender, Goal } from '../types';

export interface BodyMetrics {
    bmi: number;
    fatPercentage: number;
    muscularity: number; // 0 to 1 scale
    waistScale: number; // multiplier for waist width
    shoulderScale: number; // multiplier for shoulder width
}

/**
 * Basic body composition estimator based on available profile data.
 * Since we don't have skinfold data, we use BMI and Goal/Activity as proxies.
 */
export function estimateBodyMetrics(
    weight: number,
    height: number,
    gender: Gender,
    goal: Goal
): BodyMetrics {
    const heightM = height / 100;
    const bmi = weight / (heightM * heightM);

    // Initial estimates
    let fatPercentage = 0;
    let muscularity = 0.5;
    let waistScale = 1.0;
    let shoulderScale = 1.0;

    // Standard BF% formula (U.S. Navy/Deurenberg approximation)
    // Child/Adult formula: BF = (1.20 * BMI) + (0.23 * Age) - (10.8 * sex) - 5.4
    // simplified for context:
    if (gender === 'male') {
        fatPercentage = (1.20 * bmi) - 16;
        muscularity = 0.6;
    } else {
        fatPercentage = (1.20 * bmi) - 5;
        muscularity = 0.4;
    }

    // Adjust scales based on BMI category
    // Underweight < 18.5, Normal 18.5-25, Overweight 25-30, Obese > 30
    if (bmi < 18.5) {
        waistScale = 0.85;
        shoulderScale = 0.9;
        muscularity -= 0.1;
    } else if (bmi > 30) {
        waistScale = 1.35;
        shoulderScale = 1.1;
    } else if (bmi > 25) {
        waistScale = 1.15;
        shoulderScale = 1.05;
    }

    // Goal-based refinement (for Future view)
    if (goal === 'gain_muscle') {
        shoulderScale += 0.1;
        muscularity += 0.2;
    } else if (goal === 'lose_weight') {
        waistScale -= 0.15;
    }

    return {
        bmi: parseFloat(bmi.toFixed(1)),
        fatPercentage: Math.max(5, Math.min(50, Math.round(fatPercentage))),
        muscularity: Math.max(0, Math.min(1, muscularity)),
        waistScale,
        shoulderScale
    };
}
