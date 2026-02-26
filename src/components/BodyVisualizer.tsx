import React from 'react';
import { motion } from 'framer-motion';
import type { BodyMetrics } from '../lib/bodyComposition';
import type { Gender } from '../types';

interface Props {
    metrics: BodyMetrics;
    gender: Gender;
    color?: string;
}

export const BodyVisualizer: React.FC<Props> = ({
    metrics,
    gender,
    color = 'var(--primary)'
}) => {
    const isMale = gender === 'male' || gender === 'other';

    // Scales for morphing with safety defaults
    const s = metrics?.shoulderScale ?? 1.0;
    const w = metrics?.waistScale ?? 1.0;
    const m = metrics?.muscularity ?? 0.5;

    return (
        <div className="relative w-full aspect-[2/3] max-w-[280px] mx-auto flex items-center justify-center p-4">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-primary/5 rounded-full blur-[60px]" />

            <svg
                viewBox="0 0 100 150"
                className="w-full h-full drop-shadow-2xl overflow-visible"
                style={{ filter: 'drop-shadow(0 0 12px rgba(var(--primary-rgb), 0.3))' }}
            >
                <defs>
                    <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={color} stopOpacity="1" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.6" />
                    </linearGradient>

                    <radialGradient id="volumeGlow" cx="50%" cy="40%" r="50%">
                        <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </radialGradient>

                    <filter id="softGlow">
                        <feGaussianBlur stdDeviation="1.5" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                <motion.g
                    initial={false}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                >
                    {/* ANATOMICAL HEAD */}
                    <motion.path
                        initial={false}
                        animate={{
                            d: `M 50 5 
                               C 55 5, 58 8, 58 15 
                               C 58 22, 54 26, 50 26 
                               C 46 26, 42 22, 42 15 
                               C 42 8, 45 5, 50 5 Z`
                        }}
                        fill="url(#bodyGradient)"
                    />

                    {/* NECK */}
                    <motion.path
                        animate={{
                            d: `M 46 25 L 54 25 L 55 30 L 45 30 Z`
                        }}
                        fill="url(#bodyGradient)"
                    />

                    {/* MAIN BODY SILHOUETTE (TORSO + LEGS) */}
                    <motion.path
                        initial={false}
                        animate={{
                            d: isMale
                                ? `M 50 30 
                                   C ${50 - 22 * s} 30, ${50 - 24 * s} 35, ${50 - 20 * s} 45 
                                   C ${50 - 18 * s} 55, ${50 - 14 * w} 65, ${50 - 12 * w} 75 
                                   L ${50 - 14 * w} 85 
                                   L ${50 - 10} 145 L ${50 - 2} 145 L 50 90 
                                   L ${50 + 2} 145 L ${50 + 10} 145 
                                   L ${50 + 14 * w} 85 
                                   L ${50 + 12 * w} 75 
                                   C ${50 + 14 * w} 65, ${50 + 18 * s} 55, ${50 + 20 * s} 45 
                                   C ${50 + 24 * s} 35, ${50 + 22 * s} 30, 50 30 Z`
                                : `M 50 30 
                                   C ${50 - 18 * s} 30, ${50 - 20 * s} 35, ${50 - 16 * s} 45 
                                   C ${50 - 12 * s} 55, ${50 - 10 * w} 60, ${50 - 16 * w} 80 
                                   L ${50 - 18 * w} 90 
                                   L ${50 - 12} 145 L ${50 - 4} 145 L 50 95 
                                   L ${50 + 4} 145 L ${50 + 12} 145 
                                   L ${50 + 18 * w} 90 
                                   L ${50 + 16 * w} 80 
                                   C ${50 + 10 * w} 60, ${50 + 12 * s} 55, ${50 + 16 * s} 45 
                                   C ${50 + 20 * s} 35, ${50 + 18 * s} 30, 50 30 Z`
                        }}
                        fill="url(#bodyGradient)"
                        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                    />

                    {/* ARMS */}
                    {/* Left Arm */}
                    <motion.path
                        initial={false}
                        animate={{
                            d: `M ${50 - (isMale ? 22 : 18) * s} 32 
                               C ${50 - 26 * s} 45, ${50 - 28 * s} 55, ${50 - 24 * s} 80 
                               L ${50 - 20 * s} 80 
                               L ${50 - (isMale ? 18 : 14) * s} 45 Z`
                        }}
                        fill="url(#bodyGradient)"
                        style={{ opacity: 0.9 }}
                    />
                    {/* Right Arm */}
                    <motion.path
                        initial={false}
                        animate={{
                            d: `M ${50 + (isMale ? 22 : 18) * s} 32 
                               C ${50 + 26 * s} 45, ${50 + 28 * s} 55, ${50 + 24 * s} 80 
                               L ${50 + 20 * s} 80 
                               L ${50 + (isMale ? 18 : 14) * s} 45 Z`
                        }}
                        fill="url(#bodyGradient)"
                        style={{ opacity: 0.9 }}
                    />

                    {/* VOLUME OVERLAY (Shading) */}
                    <path d="M 50 30 Q 50 90 50 145" fill="none" stroke="white" strokeWidth="12" style={{ mixBlendMode: 'overlay', opacity: 0.1 }} />

                    {/* MUSCLE DEFINITION LAYERS */}
                    <motion.g
                        animate={{ opacity: m > 0.4 ? (m - 0.4) * 2 : 0 }}
                    >
                        {/* Chest / Pectorals */}
                        <path d="M 38 42 C 45 45, 55 45, 62 42" fill="none" stroke="white" strokeWidth="0.8" opacity="0.4" />
                        <path d="M 50 40 L 50 60" fill="none" stroke="white" strokeWidth="0.5" opacity="0.2" />

                        {/* Abs / Core */}
                        <path d="M 45 65 L 55 65" fill="none" stroke="white" strokeWidth="0.5" opacity="0.3" />
                        <path d="M 45 72 L 55 72" fill="none" stroke="white" strokeWidth="0.5" opacity="0.3" />
                        <path d="M 46 79 L 54 79" fill="none" stroke="white" strokeWidth="0.5" opacity="0.3" />

                        {/* Legs / Quads */}
                        <path d="M 40 100 Q 42 115 44 130" fill="none" stroke="white" strokeWidth="0.6" opacity="0.3" />
                        <path d="M 60 100 Q 58 115 56 130" fill="none" stroke="white" strokeWidth="0.6" opacity="0.3" />
                    </motion.g>

                    {/* Underwear/Trunks (for modesty and realism) */}
                    <motion.path
                        initial={false}
                        animate={{
                            d: isMale
                                ? `M ${50 - 12 * w} 75 L ${50 + 12 * w} 75 L ${50 + 13 * w} 85 L 50 90 L ${50 - 13 * w} 85 Z`
                                : `M ${50 - 14 * w} 75 C ${50 - 16 * w} 85, ${50 - 10 * w} 95, 50 95 C ${50 + 10 * w} 95, ${50 + 16 * w} 85, ${50 + 14 * w} 75 Z`
                        }}
                        fill="#111"
                        style={{ opacity: 0.8 }}
                    />
                </motion.g>
            </svg>

            {/* Float Labels near body */}
            <div className="absolute top-0 right-0 p-2 flex flex-col items-end">
                <div className="text-[10px] text-text-muted uppercase tracking-tighter font-bold">Composição</div>
                <div className="text-xl font-black text-text-main leading-none mt-0.5">{metrics.fatPercentage}%</div>
                <div className="text-[9px] text-primary font-black tracking-widest mt-0.5">ESTIMADA</div>
            </div>

            <div className="absolute bottom-4 left-0 p-2">
                <div className="text-[10px] text-text-muted uppercase tracking-tighter font-bold">Músculo</div>
                <div className="flex gap-1 mt-1.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div
                            key={i}
                            className={`w-3.5 h-1.5 rounded-full transition-all duration-500 ${i / 5 <= metrics.muscularity ? 'bg-primary shadow-[0_0_5px_rgba(var(--primary-rgb),0.5)]' : 'bg-primary/10'}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
