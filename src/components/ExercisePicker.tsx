import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, X, Check, Loader2, Dumbbell, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { aiService } from '../services/aiService';
import { moderateContent } from '../services/moderationService';
import type { CommunityExercise } from '../types';

interface Props {
    category?: 'musculacao' | 'cardio';
    modalityId?: string;
    selected: CommunityExercise[];
    onToggle: (exercise: CommunityExercise) => void;
    onClose: () => void;
}

const MUSCLE_GROUPS = ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Pernas', 'Glúteos', 'Abdômen', 'Cardio'];

export default function ExercisePicker({ category = 'musculacao', modalityId, selected, onToggle, onClose }: Props) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<CommunityExercise[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterMuscle, setFilterMuscle] = useState('');
    const [showNewForm, setShowNewForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newMuscle, setNewMuscle] = useState('');
    const [newEquip, setNewEquip] = useState('');
    const [saving, setSaving] = useState(false);
    const [moderating, setModerating] = useState(false);
    const [modError, setModError] = useState('');

    const search = useCallback(async (q: string, muscle: string) => {
        setLoading(true);
        try {
            let dbQuery = supabase
                .from('community_exercises')
                .select('*')
                .eq('category', category)
                .order('created_at', { ascending: false })
                .limit(40);

            if (modalityId) dbQuery = dbQuery.eq('modality_id', modalityId);
            if (muscle) dbQuery = dbQuery.ilike('muscle_group', muscle);
            if (q.trim()) dbQuery = dbQuery.ilike('name', `%${q.trim()}%`);

            const { data } = await dbQuery;
            setResults(data ?? []);
        } finally {
            setLoading(false);
        }
    }, [category, modalityId]);

    useEffect(() => {
        search(query, filterMuscle);
    }, [query, filterMuscle, search]);

    const isSelected = (ex: CommunityExercise) => selected.some(s => s.id === ex.id);

    async function handleAddNew() {
        if (!newName.trim()) return;
        setModError('');
        setModerating(true);
        const modResult = await moderateContent(newName.trim(), 'exercício');
        setModerating(false);
        if (!modResult.ok) { setModError(modResult.reason); return; }

        setSaving(true);
        try {
            const instructions = await aiService.generateExerciseInstructions(
                newName.trim(), category, undefined
            );
            const { data: inserted, error } = await supabase
                .from('community_exercises')
                .insert({
                    name: newName.trim(),
                    category,
                    modality_id: modalityId ?? null,
                    muscle_group: newMuscle || null,
                    equipment: newEquip || 'livre',
                    instructions: instructions || null,
                })
                .select()
                .single();

            if (!error && inserted) {
                onToggle(inserted as CommunityExercise);
                setNewName(''); setNewMuscle(''); setNewEquip('');
                setShowNewForm(false);
                search(query, filterMuscle);
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'var(--bg-main)' }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-14 pb-3 border-b" style={{ borderColor: 'var(--border-main)' }}>
                <button onClick={onClose} className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(var(--text-main-rgb),0.06)' }}>
                    <X size={20} />
                </button>
                <h2 className="font-bold text-lg flex-1">Adicionar Exercícios</h2>
                <span className="text-xs text-text-muted font-medium">{selected.length} selecionados</span>
            </div>

            {/* Search */}
            <div className="px-4 py-3 flex gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-xl px-3" style={{ backgroundColor: 'rgba(var(--text-main-rgb),0.06)', border: '1px solid var(--border-main)' }}>
                    <Search size={16} className="text-text-muted shrink-0" />
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar exercício..."
                        className="flex-1 bg-transparent text-sm py-2.5 outline-none text-text-main placeholder:text-text-muted"
                        autoFocus
                    />
                    {query && <button onClick={() => setQuery('')}><X size={14} className="text-text-muted" /></button>}
                </div>
            </div>

            {/* Muscle group filter */}
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
                {['', ...MUSCLE_GROUPS].map(m => (
                    <button
                        key={m}
                        onClick={() => setFilterMuscle(m)}
                        className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all"
                        style={{
                            backgroundColor: filterMuscle === m ? 'var(--primary)' : 'rgba(var(--text-main-rgb),0.06)',
                            color: filterMuscle === m ? '#fff' : 'var(--text-muted)',
                        }}
                    >
                        {m || 'Todos'}
                    </button>
                ))}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-4 pb-24">
                {loading ? (
                    <div className="flex justify-center pt-10">
                        <Loader2 size={24} className="animate-spin text-primary" />
                    </div>
                ) : results.length === 0 ? (
                    <div className="text-center py-12">
                        <Dumbbell size={40} className="mx-auto text-text-muted opacity-30 mb-3" />
                        <p className="text-text-muted text-sm">Nenhum exercício encontrado</p>
                        <button
                            onClick={() => { setShowNewForm(true); setNewName(query); }}
                            className="mt-3 text-primary text-sm font-semibold underline"
                        >
                            Cadastrar "{query || 'novo exercício'}"
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 py-2">
                        {results.map(ex => {
                            const sel = isSelected(ex);
                            return (
                                <motion.button
                                    key={ex.id}
                                    layout
                                    onClick={() => onToggle(ex)}
                                    className="flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all"
                                    style={{
                                        backgroundColor: sel ? 'rgba(var(--primary-rgb),0.12)' : 'rgba(var(--text-main-rgb),0.04)',
                                        border: `1px solid ${sel ? 'rgba(var(--primary-rgb),0.3)' : 'var(--border-main)'}`,
                                    }}
                                >
                                    <div
                                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: sel ? 'var(--primary)' : 'rgba(var(--text-main-rgb),0.08)' }}
                                    >
                                        {sel ? <Check size={16} className="text-white" /> : <Dumbbell size={16} className="text-text-muted" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-text-main truncate">{ex.name}</p>
                                        <p className="text-xs text-text-muted truncate">
                                            {[ex.muscle_group, ex.equipment].filter(Boolean).join(' · ') || 'Livre'}
                                        </p>
                                    </div>
                                    {sel && <span className="text-xs text-primary font-bold shrink-0">✓</span>}
                                </motion.button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Bottom: Add new + Confirm */}
            <div className="fixed bottom-0 left-0 right-0 p-4 flex flex-col gap-2" style={{ backgroundColor: 'var(--bg-main)', borderTop: '1px solid var(--border-main)' }}>
                {/* New exercise form */}
                <AnimatePresence>
                    {showNewForm && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="rounded-2xl p-4 flex flex-col gap-3 mb-1"
                            style={{ backgroundColor: 'rgba(var(--primary-rgb),0.08)', border: '1px solid rgba(var(--primary-rgb),0.2)' }}
                        >
                            <p className="text-xs font-bold text-primary uppercase tracking-widest">Novo exercício</p>
                            <input
                                value={newName}
                                onChange={e => { setNewName(e.target.value); setModError(''); }}
                                placeholder="Nome do exercício *"
                                className="w-full bg-transparent text-sm py-2 outline-none border-b text-text-main placeholder:text-text-muted"
                                style={{ borderColor: 'var(--border-main)' }}
                            />
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <select
                                        value={newMuscle}
                                        onChange={e => setNewMuscle(e.target.value)}
                                        className="w-full bg-transparent text-xs py-1.5 outline-none text-text-muted appearance-none pr-5"
                                    >
                                        <option value="">Grupo muscular</option>
                                        {MUSCLE_GROUPS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <ChevronDown size={12} className="absolute right-0 top-2 text-text-muted pointer-events-none" />
                                </div>
                                <input
                                    value={newEquip}
                                    onChange={e => setNewEquip(e.target.value)}
                                    placeholder="Equipamento"
                                    className="flex-1 bg-transparent text-xs py-1.5 outline-none border-b text-text-muted placeholder:text-text-muted"
                                    style={{ borderColor: 'var(--border-main)' }}
                                />
                            </div>
                            {modError && (
                                <p className="text-xs text-gordura font-medium">{modError}</p>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setShowNewForm(false); setModError(''); }}
                                    className="flex-1 py-2 rounded-xl text-xs font-semibold text-text-muted"
                                    style={{ backgroundColor: 'rgba(var(--text-main-rgb),0.06)' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleAddNew}
                                    disabled={!newName.trim() || saving || moderating}
                                    className="flex-1 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    style={{ backgroundColor: 'var(--primary)' }}
                                >
                                    {moderating ? <><Loader2 size={14} className="animate-spin" /> Verificando...</> :
                                        saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> :
                                            <><Plus size={14} /> Cadastrar</>}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex gap-2">
                    <button
                        onClick={() => setShowNewForm(v => !v)}
                        className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold"
                        style={{ backgroundColor: 'rgba(var(--primary-rgb),0.1)', color: 'var(--primary)', border: '1px solid rgba(var(--primary-rgb),0.2)' }}
                    >
                        <Plus size={16} /> Novo
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-2xl text-sm font-bold text-white"
                        style={{ backgroundColor: 'var(--primary)' }}
                    >
                        Confirmar ({selected.length})
                    </button>
                </div>
            </div>
        </div>
    );
}
