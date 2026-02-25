import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Dumbbell, Apple, Trophy, User, Flame, Zap, BarChart3, TrendingUp, ChevronRight, CheckCircle2, BedDouble, ChevronUp, Menu, X, Users, LogOut, UserCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getLocalYYYYMMDD } from '../lib/dateUtils';
import type { Profile, WorkoutPlan, Gamification, WorkoutCategory } from '../types';
import WorkoutHub from './WorkoutHub';
import NutritionLog from './NutritionLog';
import GamificationView from './Gamification';
import ProfileView from './ProfileView';
import AIAssistant from './AIAssistant';
import DailyRewardModal from './DailyRewardModal';
import CommunityHub from './CommunityHub';

interface Props {
    profile: Profile;
    musculacaoPlan: WorkoutPlan | null;
    cardioPlan: WorkoutPlan | null;
    modalidadePlan: WorkoutPlan | null;
    gamification: Gamification | null;
    onSignOut: () => void;
    onRefresh: () => void;
    onPlanChange: (category: WorkoutCategory, plan: WorkoutPlan) => void;
}

type Tab = 'home' | 'workout' | 'nutrition' | 'gamification' | 'profile';

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Início', icon: <Home size={22} /> },
    { id: 'workout', label: 'Treino', icon: <Dumbbell size={22} /> },
    { id: 'nutrition', label: 'Dieta', icon: <Apple size={22} /> },
    { id: 'gamification', label: 'Evolução', icon: <Trophy size={22} /> },
    { id: 'profile', label: 'Perfil', icon: <User size={22} /> },
];

function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
}

function getTodayWorkout(plan: WorkoutPlan | null) {
    if (!plan) return null;
    const createdAt = new Date(plan.created_at);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - createdAt.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const currentWeekIdx = Math.floor(diffDays / 7);

    const weeks = plan.plan_data?.weeks;
    if (!weeks?.length) return null;
    const currentWeek = weeks[currentWeekIdx % weeks.length];
    const dayOfWeek = today.getDay(); // 0=Sun
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return currentWeek.days[dayIndex % currentWeek.days.length] || null;
}

const pageVariants = {
    enter: { opacity: 0, x: 20 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
};

interface NutritionTotals {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

export default function Dashboard({ profile, musculacaoPlan, cardioPlan, modalidadePlan, gamification, onSignOut, onRefresh, onPlanChange }: Props) {
    const [activeTab, setActiveTab] = useState<Tab>(() => {
        return (sessionStorage.getItem('activeTab') as Tab) || 'home';
    });
    const [nutritionTotals, setNutritionTotals] = useState<NutritionTotals | null>(null);
    const [showDailyReward, setShowDailyReward] = useState(false);
    const [totalLoad, setTotalLoad] = useState(0);
    const [freqTrend, setFreqTrend] = useState(0);
    const [weeklyPerf, setWeeklyPerf] = useState<number[]>([]);
    const [showMenu, setShowMenu] = useState(false);
    const [showCommunity, setShowCommunity] = useState(false);
    const [pendingRequests, setPendingRequests] = useState(0);

    useEffect(() => {
        const todayStr = getLocalYYYYMMDD();
        const lastCheck = localStorage.getItem('lastDailyRewardCheck');
        if (lastCheck !== todayStr) {
            setShowDailyReward(true);
            localStorage.setItem('lastDailyRewardCheck', todayStr);
        }
    }, []);

    // Load pending follow-request count for the hamburger badge
    useEffect(() => {
        supabase
            .from('follows')
            .select('id', { count: 'exact', head: true })
            .eq('following_id', profile.id)
            .eq('status', 'pending')
            .then(({ count }) => setPendingRequests(count ?? 0));
    }, [profile.id]);

    useEffect(() => {
        sessionStorage.setItem('activeTab', activeTab);
        window.scrollTo({ top: 0, behavior: 'auto' });

        if (activeTab === 'home') {
            const ymd = getLocalYYYYMMDD();
            // Fetch nutrition
            if (!nutritionTotals) {
                supabase.from('meals')
                    .select('calories, protein, carbs, fat')
                    .eq('user_id', profile.id)
                    .eq('meal_date', ymd)
                    .then(({ data }) => {
                        if (data) {
                            const t = data.reduce((acc, curr) => ({
                                calories: acc.calories + (curr.calories || 0),
                                protein: acc.protein + (curr.protein || 0),
                                carbs: acc.carbs + (curr.carbs || 0),
                                fat: acc.fat + (curr.fat || 0)
                            }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
                            setNutritionTotals(t);
                        }
                    });
            }

            // Fetch real Exercise Stats
            const fetchStats = async () => {
                const now = new Date();
                const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
                const startOfPrevWeek = new Date(new Date(startOfWeek).setDate(startOfWeek.getDate() - 7));

                // Total load kg
                const { data: sessions } = await supabase.from('workout_sessions')
                    .select('total_load_kg, session_date')
                    .eq('user_id', profile.id)
                    .eq('completed', true);

                if (sessions) {
                    const total = sessions.reduce((acc, s) => acc + (s.total_load_kg || 0), 0);
                    setTotalLoad(total);

                    // Calc Frequency Trend
                    const thisWeek = sessions.filter(s => new Date(s.session_date) >= startOfWeek).length;
                    const lastWeek = sessions.filter(s => {
                        const d = new Date(s.session_date);
                        return d >= startOfPrevWeek && d < startOfWeek;
                    }).length;

                    if (lastWeek > 0) {
                        setFreqTrend(Math.round(((thisWeek - lastWeek) / lastWeek) * 100));
                    } else if (thisWeek > 0) {
                        setFreqTrend(100);
                    }

                    // Calc Weekly Perf (last 7 days)
                    const last7: number[] = [];
                    for (let i = 6; i >= 0; i--) {
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        const dStr = d.toISOString().split('T')[0];
                        const count = sessions.filter(s => s.session_date === dStr).length;
                        last7.push(count > 0 ? 100 : 20); // 100% height if trained, 20% if not
                    }
                    setWeeklyPerf(last7);
                }
            };
            fetchStats();
        }
    }, [activeTab, profile.id, nutritionTotals]);

    const todayWorkout = getTodayWorkout(musculacaoPlan);

    // Calc Dedication Score (min 32.5, max 100)
    const dedication = gamification
        ? Math.min(100, Math.max(32.5, (gamification.streak_days * 5) + (gamification.total_workouts * 3) + (gamification.total_meals_logged * 1)))
        : 32.5;

    return (
        <div className="min-h-screen flex flex-col font-sans bg-dark text-text-main">
            {/* Top header */}
            <header className="flex items-center justify-between px-5 pt-14 pb-5 safe-top border-b bg-dark" style={{ borderColor: 'var(--border-main)' }}>
                {/* Hamburger */}
                <button
                    onClick={() => setShowMenu(true)}
                    className="p-2 rounded-xl"
                    style={{ backgroundColor: 'rgba(var(--text-main-rgb),0.06)' }}
                    aria-label="Menu"
                >
                    <Menu size={20} className="text-text-main" />
                </button>

                {/* Logo */}
                <span className="font-['Quicksand'] font-bold text-xl lowercase text-text-main">niume</span>

                {/* Avatar with pending-request dot */}
                <div className="relative">
                    <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-primary/20"
                        style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))' }}
                    >
                        {profile.name.charAt(0).toUpperCase()}
                    </div>
                    {pendingRequests > 0 && (
                        <span
                            className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full"
                            style={{ backgroundColor: 'var(--accent)', border: '2px solid var(--bg-main)' }}
                        />
                    )}
                </div>
            </header>

            {showDailyReward && (
                <DailyRewardModal
                    profile={profile}
                    gamification={gamification}
                    onClose={() => setShowDailyReward(false)}
                />
            )}


            {/* Content */}
            <main className="flex-1 overflow-y-auto pb-20 bg-dark">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        variants={pageVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.2 }}
                    >
                        {/* ===== HOME ===== */}
                        {activeTab === 'home' && (
                            <div className="px-4 py-5 flex flex-col gap-5 max-w-lg mx-auto">
                                {/* Greeting */}
                                <div>
                                    <h1 className="text-xl font-semibold text-text-main tracking-tight">
                                        {getGreeting()}, {profile.name.split(' ')[0]}.
                                    </h1>
                                    <p className="text-text-muted text-xs mt-1 font-medium">
                                        {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </p>
                                </div>


                                {/* Results Analysis Overview */}
                                <div className="p-5 rounded-2xl bg-card border shadow-2xl backdrop-blur-sm" style={{ borderColor: 'var(--border-main)' }}>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-sm font-semibold text-text-main flex items-center gap-2"><BarChart3 size={16} className="text-primary" /> Análise de Desempenho</h3>
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        <div>
                                            <div className="flex justify-between text-xs text-text-muted mb-1.5 font-medium"><span>Evolução da Dedicação</span><span className="text-primary">{dedication.toFixed(0)}%</span></div>
                                            <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(var(--text-main-rgb), 0.1)' }}>
                                                <motion.div
                                                    initial={{ opacity: 0, width: 0 }}
                                                    animate={{ opacity: 1, width: `${dedication}%` }}
                                                    transition={{ duration: 1 }}
                                                    className="h-full rounded-full"
                                                    style={{ background: 'linear-gradient(to right, var(--primary), rgba(var(--primary-rgb), 0.6))' }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Stats grid */}
                                <div className="flex flex-col gap-3">
                                    {/* 1. Treino Hoje (Full Width + Weekly Graph) */}
                                    <div className="rounded-2xl p-4 relative overflow-hidden bg-card border border-primary/20 backdrop-blur-sm transition-all shadow-[0_4px_20px_-5px_rgba(var(--primary-rgb),0.15)] flex flex-col gap-3">
                                        <div className="flex justify-between items-start relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/20 border border-primary/30">
                                                    {todayWorkout?.type === 'rest' ? <BedDouble size={20} className="text-primary" /> : <Dumbbell size={20} className="text-primary" />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-0.5">Treino Hoje</p>
                                                    <h3 className="text-text-main font-bold text-base leading-tight">
                                                        {todayWorkout?.name || 'Sem plano para hoje'}
                                                    </h3>
                                                    <p className="text-text-muted text-xs mt-0.5 font-medium">
                                                        {todayWorkout?.type === 'rest' ? 'Dia de descanso' : `${todayWorkout?.exercises?.length ?? 0} exercícios no total`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="w-16 h-8 flex items-end gap-1 opacity-70">
                                                {/* Real Weekly Performance Graph */}
                                                {(weeklyPerf.length > 0 ? weeklyPerf : [20, 20, 20, 20, 20, 20, 20]).map((h, i) => (
                                                    <div key={i} className="flex-1 rounded-sm bg-primary transition-all duration-500" style={{ height: `${h}%`, opacity: h > 20 ? 1 : 0.3 }} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Meta Calórica (Full Width + Consumed/Remaining) */}
                                    <div className="rounded-2xl p-4 relative overflow-hidden bg-card border border-accent/20 backdrop-blur-sm shadow-[0_4px_20px_-5px_rgba(var(--accent-rgb),0.15)] flex flex-col gap-3">
                                        <div className="flex items-center gap-3 relative z-10 w-full">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent/20 border border-accent/30 shrink-0">
                                                <Flame size={20} className="text-accent" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-1 cursor-default">
                                                    <p className="text-[10px] text-accent font-bold uppercase tracking-widest">Meta Calórica</p>
                                                    <span className="text-xs text-accent/80 font-bold tabular-nums">{nutritionTotals?.calories || 0} / {profile.daily_calorie_goal} kcal</span>
                                                </div>
                                                <div className="h-2 w-full rounded-full overflow-hidden mb-1.5 relative" style={{ backgroundColor: 'rgba(var(--text-main-rgb), 0.1)' }}>
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${Math.min(100, ((nutritionTotals?.calories || 0) / profile.daily_calorie_goal) * 100)}%` }}
                                                        transition={{ duration: 1 }}
                                                        className="absolute left-0 top-0 h-full rounded-full"
                                                        style={{ background: 'linear-gradient(to right, var(--accent), rgba(var(--accent-rgb), 0.6))' }}
                                                    />
                                                </div>
                                                <p className="text-text-muted text-xs font-medium truncate">
                                                    Restam <span className="text-text-main font-bold">{Math.max(0, profile.daily_calorie_goal - (nutritionTotals?.calories || 0))} kcal</span> para o limite hoje.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 w-full">
                                        {/* 3. Carga Total (Half Width + Volume Graph) */}
                                        <div className="rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden bg-card border border-proteina/20 backdrop-blur-sm transition-all shadow-[0_4px_20px_-5px_rgba(var(--proteina-rgb),0.1)]">
                                            <div className="flex justify-between items-start relative z-10">
                                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-proteina/10 border border-proteina/20">
                                                    <TrendingUp size={18} className="text-proteina" />
                                                </div>
                                                <div className="w-12 h-6 flex items-end opacity-60">
                                                    <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
                                                        <polyline fill="none" stroke="var(--proteina)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points="0,35 25,20 50,25 75,10 100,5" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className="relative z-10 mt-1">
                                                <p className="text-[10px] text-proteina font-bold uppercase tracking-widest mb-1 truncate">Volume de Carga</p>
                                                <div className="flex items-baseline gap-1.5">
                                                    <p className="text-text-main font-extrabold text-[1.1rem] leading-none truncate">{totalLoad > 1000 ? (totalLoad / 1000).toFixed(1) + 'k' : totalLoad}</p>
                                                    <span className="text-text-muted text-xs font-medium">kg</span>
                                                </div>
                                                <p className="text-text-muted text-[9px] mt-1.5 font-medium uppercase truncate">ACUMULADO</p>
                                            </div>
                                        </div>

                                        {/* 4. Frequência (Half Width + Comparison Trend) */}
                                        <div className="rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden bg-card border border-primary/20 backdrop-blur-sm transition-all shadow-[0_4px_20px_-5px_rgba(var(--primary-rgb),0.1)]">
                                            <div className="flex justify-between items-start relative z-10">
                                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20">
                                                    <CheckCircle2 size={18} className="text-primary" />
                                                </div>
                                                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border" style={{ backgroundColor: 'rgba(var(--text-main-rgb), 0.05)', borderColor: 'var(--border-main)' }}>
                                                    <ChevronUp size={12} className={freqTrend >= 0 ? "text-proteina" : "text-accent"} style={{ transform: freqTrend < 0 ? 'rotate(180deg)' : 'none' }} />
                                                    <span className={`text-[10px] font-bold ${freqTrend >= 0 ? "text-proteina" : "text-accent"}`}>{Math.abs(freqTrend)}%</span>
                                                </div>
                                            </div>
                                            <div className="relative z-10 mt-1">
                                                <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-1 truncate">Frequência</p>
                                                <div className="flex items-baseline gap-1.5">
                                                    <p className="text-text-main font-extrabold text-[1.1rem] leading-none truncate">{gamification?.total_workouts || 0}</p>
                                                    <span className="text-text-muted text-[10px] font-medium uppercase">Treinos</span>
                                                </div>
                                                <p className="text-text-muted text-[9px] mt-1.5 font-medium uppercase truncate">V.S. SEMANA PASSADA</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {todayWorkout && todayWorkout.type !== 'rest' && (
                                    <div className="rounded-2xl p-5 bg-card border hover:border-primary/30 transition-colors" style={{ borderColor: 'var(--border-main)' }}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">PROGRAMA DE HOJE</p>
                                                <h3 className="text-lg font-bold text-text-main tracking-tight">{todayWorkout.name}</h3>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-text-muted mb-4">
                                            <span className="flex items-center gap-1.5"><Dumbbell size={14} />{todayWorkout.exercises.length} exercícios</span>
                                            <span className="flex items-center gap-1.5"><Zap size={14} />{profile.available_minutes} min</span>
                                        </div>
                                        <button
                                            onClick={() => setActiveTab('workout')}
                                            className="w-full py-3.5 rounded-xl font-bold text-white text-sm bg-primary hover:bg-primary-hover transition-colors flex justify-center items-center gap-2 shadow-lg shadow-primary/20"
                                        >
                                            Iniciar Sessão <ChevronRight size={16} />
                                        </button>
                                    </div>
                                )}

                                {todayWorkout?.type === 'rest' && (
                                    <div className="rounded-2xl p-6 text-center bg-card border" style={{ borderColor: 'var(--border-main)' }}>
                                        <BedDouble size={36} className="mx-auto text-primary opacity-80 mb-3" />
                                        <p className="text-text-main font-semibold text-sm">Dia de Descanso</p>
                                        <p className="text-text-muted text-xs mt-1.5 leading-relaxed">Aproveite para recuperar os músculos. O descanso também faz parte do treino!</p>
                                    </div>
                                )}

                                {/* Plan description */}
                                {musculacaoPlan?.description && (
                                    <div className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.08)', border: '1px solid rgba(var(--primary-rgb), 0.15)' }}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Flame size={16} className="text-primary" />
                                            <span className="text-xs font-semibold uppercase tracking-wide text-primary opacity-80">Dica do Plano</span>
                                        </div>
                                        <p className="text-text-muted text-sm">{musculacaoPlan.description}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ===== WORKOUT TAB ===== */}
                        {activeTab === 'workout' && (
                            <WorkoutHub
                                musculacaoPlan={musculacaoPlan}
                                cardioPlan={cardioPlan}
                                modalidadePlan={modalidadePlan}
                                profile={profile}
                                onPlanChange={onPlanChange}
                                onComplete={() => onRefresh()}
                            />
                        )}

                        {/* ===== NUTRITION TAB ===== */}
                        {activeTab === 'nutrition' && (
                            <NutritionLog
                                profile={profile}
                                onUpdate={onRefresh}
                                onNutritionChange={setNutritionTotals}
                            />
                        )}

                        {/* ===== GAMIFICATION TAB ===== */}
                        {activeTab === 'gamification' && (
                            <GamificationView
                                gamification={gamification}
                                profile={profile}
                                onUpdate={onRefresh}
                            />
                        )}

                        {/* ===== PROFILE TAB ===== */}
                        {activeTab === 'profile' && (
                            <ProfileView
                                profile={profile}
                                onSignOut={onSignOut}
                                onRefresh={onRefresh}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* VERSION INDICATOR */}
                <div className="flex justify-center mt-8 mb-4">
                    <span className="text-[10px] text-text-muted/40 font-semibold tracking-widest uppercase">Versão 1.3.1</span>
                </div>
            </main>

            {/* AI Assistant (floating) */}
            <AIAssistant
                profile={profile}
                nutritionData={nutritionTotals ? (() => {
                    const calGoal = profile.daily_calorie_goal || 2000;
                    return {
                        ...nutritionTotals,
                        calGoal,
                        protGoal: Math.round((calGoal * 0.3) / 4),
                        carbGoal: Math.round((calGoal * 0.4) / 4),
                        fatGoal: Math.round((calGoal * 0.3) / 9),
                    };
                })() : null}
            />

            {/* Bottom nav */}
            <nav
                className="fixed bottom-0 left-0 right-0 safe-bottom z-50 backdrop-blur-md"
                style={{ backgroundColor: 'rgba(var(--bg-main-rgb), 0.95)', borderTop: '1px solid rgba(var(--text-main-rgb), 0.08)' }}
            >
                <div className="flex items-center justify-around px-2 py-2">
                    {tabs.map((t) => {
                        const active = activeTab === t.id;
                        return (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id)}
                                className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all min-w-0 relative"
                                style={{ color: active ? 'var(--primary)' : 'var(--text-muted)' }}
                            >
                                <motion.div animate={{ scale: active ? 1.1 : 1 }} transition={{ duration: 0.15 }}>
                                    {t.icon}
                                </motion.div>
                                <span className="text-xs font-medium truncate">{t.label}</span>
                                {active && (
                                    <motion.div
                                        layoutId="nav-indicator"
                                        className="absolute bottom-1 w-1 h-1 rounded-full bg-primary"
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            </nav>
            {/* ── Hamburger Drawer ── */}
            <AnimatePresence>
                {showMenu && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowMenu(false)}
                            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
                        />
                        {/* Side drawer */}
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                            className="fixed left-0 top-0 bottom-0 z-[90] w-72 flex flex-col bg-card"
                            style={{ borderRight: '1px solid var(--border-main)' }}
                        >
                            {/* Close + user card */}
                            <div className="px-5 pt-14 pb-5">
                                <div className="flex justify-end mb-5">
                                    <button
                                        onClick={() => setShowMenu(false)}
                                        className="p-2 rounded-xl"
                                        style={{ backgroundColor: 'rgba(var(--text-main-rgb),0.06)' }}
                                    >
                                        <X size={18} className="text-text-muted" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white"
                                        style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))' }}
                                    >
                                        {profile.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold text-text-main">{profile.name.split(' ')[0]}</p>
                                        <p className="text-xs text-text-muted">
                                            Nível {gamification?.level ?? 1} · 🔥 {gamification?.streak_days ?? 0} dias
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="h-px mx-5 mb-2" style={{ backgroundColor: 'var(--border-main)' }} />

                            {/* Menu items */}
                            <div className="flex flex-col px-3 gap-1 flex-1 pt-2">
                                <button
                                    onClick={() => { setShowMenu(false); setShowCommunity(true); }}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left"
                                >
                                    <Users size={20} className="text-primary shrink-0" />
                                    <span className="font-medium text-sm text-text-main">Comunidade</span>
                                    {pendingRequests > 0 && (
                                        <span
                                            className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                                            style={{ backgroundColor: 'var(--accent)' }}
                                        >
                                            {pendingRequests}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => { setShowMenu(false); setActiveTab('profile'); }}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left"
                                >
                                    <UserCheck size={20} className="text-primary shrink-0" />
                                    <span className="font-medium text-sm text-text-main">Meu Perfil</span>
                                </button>
                            </div>

                            {/* Sign out */}
                            <div className="px-3 pb-10">
                                <div className="h-px mb-3" style={{ backgroundColor: 'var(--border-main)' }} />
                                <button
                                    onClick={() => { setShowMenu(false); onSignOut(); }}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors w-full text-left"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    <LogOut size={18} className="shrink-0" />
                                    <span className="text-sm">Sair</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── Community Hub overlay ── */}
            <AnimatePresence>
                {showCommunity && (
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 30 }}
                        transition={{ duration: 0.22 }}
                        className="fixed inset-0 z-[100]"
                        style={{ backgroundColor: 'var(--bg-main)' }}
                    >
                        <CommunityHub
                            profile={profile}
                            gamification={gamification}
                            onClose={() => setShowCommunity(false)}
                            onPendingChange={setPendingRequests}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
