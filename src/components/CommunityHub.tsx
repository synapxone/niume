import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, Activity, Compass, Bell, UserCheck, Users,
    Loader2, UserPlus, Check, X, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import type { Profile, Gamification, CommunityFeedItem, ReactionType } from '../types';

// ─── Local types ──────────────────────────────────────────────────────────────
type ExploreUser   = { id: string; name: string; followStatus?: 'pending' | 'accepted' };
type RequestUser   = { id: string; name: string; follow_id: string };
type FollowingUser = { id: string; name: string; follow_id: string };
type HubView = 'feed' | 'explore' | 'requests' | 'following';

interface Props {
    profile: Profile;
    gamification: Gamification | null;
    onClose: () => void;
    onPendingChange: (count: number) => void;
}

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
    { type: 'parabens',   emoji: '👏', label: 'Parabéns' },
    { type: 'arrasou',    emoji: '🔥', label: 'Arrasou' },
    { type: 'nao_desista', emoji: '💪', label: 'Não desista' },
];

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (m < 2) return 'agora';
    if (m < 60) return `há ${m} min`;
    if (h < 24) return `há ${h}h`;
    if (d === 1) return 'ontem';
    if (d < 7) return `há ${d} dias`;
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AvatarBubble({ name, size = 10, color = 'var(--primary)' }: { name: string; size?: number; color?: string }) {
    return (
        <div
            className="rounded-2xl flex items-center justify-center font-bold text-white shrink-0"
            style={{
                width: size * 4,
                height: size * 4,
                fontSize: size * 1.6,
                background: `linear-gradient(135deg, ${color}, ${color}aa)`,
            }}
        >
            {name.charAt(0).toUpperCase()}
        </div>
    );
}

function UserCard({ name, action }: { name: string; action: React.ReactNode }) {
    return (
        <div
            className="p-4 rounded-2xl flex items-center gap-3"
            style={{ backgroundColor: 'rgba(var(--text-main-rgb),0.04)', border: '1px solid var(--border-main)' }}
        >
            <AvatarBubble name={name} />
            <p className="font-semibold text-text-main text-sm flex-1">{name}</p>
            {action}
        </div>
    );
}

function FeedCard({ item, onReact }: { item: CommunityFeedItem; onReact: (item: CommunityFeedItem, r: ReactionType) => void }) {
    return (
        <div
            className="p-4 rounded-2xl flex flex-col gap-3"
            style={{ backgroundColor: 'rgba(var(--text-main-rgb),0.04)', border: '1px solid var(--border-main)' }}
        >
            {/* User row */}
            <div className="flex items-center gap-3">
                <AvatarBubble name={item.user_first_name} size={9} />
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-main text-sm">{item.user_first_name}</p>
                    <p className="text-xs text-text-muted">{timeAgo(item.created_at)}</p>
                </div>
                <span
                    className="text-xs px-2 py-1 rounded-lg font-semibold shrink-0"
                    style={{
                        backgroundColor: item.activity_type === 'workout'
                            ? 'rgba(var(--primary-rgb),0.12)'
                            : 'rgba(var(--accent-rgb),0.12)',
                        color: item.activity_type === 'workout' ? 'var(--primary)' : 'var(--accent)',
                    }}
                >
                    {item.activity_type === 'workout' ? '💪 Musculação' : `🏃 ${item.cardio_type ?? 'Cardio'}`}
                </span>
            </div>

            {/* Metrics */}
            {(item.duration_minutes || item.total_load_kg || item.distance_km || item.calories_burned) && (
                <div className="flex flex-wrap gap-3 text-xs text-text-muted">
                    {item.duration_minutes  && <span>⏱ {item.duration_minutes} min</span>}
                    {item.total_load_kg     && <span>🏋️ {item.total_load_kg} kg</span>}
                    {item.distance_km       && <span>📍 {item.distance_km} km</span>}
                    {item.calories_burned   && <span>🔥 {item.calories_burned} kcal</span>}
                </div>
            )}

            {/* Reactions */}
            <div className="flex gap-2">
                {REACTIONS.map(r => {
                    const count = item.reaction_counts[r.type];
                    const isActive = item.my_reaction === r.type;
                    return (
                        <button
                            key={r.type}
                            onClick={() => onReact(item, r.type)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                            style={{
                                backgroundColor: isActive
                                    ? 'rgba(var(--primary-rgb),0.15)'
                                    : 'rgba(var(--text-main-rgb),0.06)',
                                border: `1px solid ${isActive ? 'rgba(var(--primary-rgb),0.3)' : 'var(--border-main)'}`,
                                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                            }}
                        >
                            {r.emoji} {count > 0 ? count : r.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CommunityHub({ profile, onClose, onPendingChange }: Props) {
    const [view, setView]               = useState<HubView>('feed');
    const [feedItems, setFeedItems]     = useState<CommunityFeedItem[]>([]);
    const [exploreUsers, setExplore]    = useState<ExploreUser[]>([]);
    const [requestUsers, setRequests]   = useState<RequestUser[]>([]);
    const [followingUsers, setFollowing] = useState<FollowingUser[]>([]);
    const [loading, setLoading]         = useState(true);
    const [searchQuery, setSearch]      = useState('');
    const [pendingCount, setPending]    = useState(0);

    // Load pending count on mount for badge display
    useEffect(() => {
        supabase
            .from('follows')
            .select('id', { count: 'exact', head: true })
            .eq('following_id', profile.id)
            .eq('status', 'pending')
            .then(({ count }) => {
                const c = count ?? 0;
                setPending(c);
                onPendingChange(c);
            });
    }, []);

    // Load data when view changes
    useEffect(() => {
        setLoading(true);
        (async () => {
            try {
                if (view === 'feed')      await loadFeed();
                if (view === 'explore')   await loadExplore();
                if (view === 'requests')  await loadRequests();
                if (view === 'following') await loadFollowing();
            } finally {
                setLoading(false);
            }
        })();
    }, [view]);

    // ── Data loaders ──────────────────────────────────────────────────────────

    async function loadFeed() {
        const { data: followData } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', profile.id)
            .eq('status', 'accepted');

        const ids = followData?.map(f => f.following_id) ?? [];
        if (ids.length === 0) { setFeedItems([]); return; }

        // Profiles for name lookup
        const { data: profilesData } = await supabase
            .from('profiles').select('id, name').in('id', ids);
        const nameMap = new Map(profilesData?.map(p => [p.id, p.name as string]) ?? []);

        // Sessions in parallel
        const [{ data: ws }, { data: cs }] = await Promise.all([
            supabase.from('workout_sessions')
                .select('id, user_id, duration_minutes, total_load_kg, created_at')
                .in('user_id', ids).eq('completed', true)
                .order('created_at', { ascending: false }).limit(20),
            supabase.from('cardio_sessions')
                .select('id, user_id, cardio_type, duration_minutes, distance_km, calories_burned, created_at')
                .in('user_id', ids)
                .order('created_at', { ascending: false }).limit(20),
        ]);

        const allIds = [...(ws?.map(s => s.id) ?? []), ...(cs?.map(s => s.id) ?? [])];
        const [{ data: myR }, { data: allR }] = allIds.length > 0
            ? await Promise.all([
                supabase.from('community_reactions').select('target_id, reaction_type')
                    .eq('user_id', profile.id).in('target_id', allIds),
                supabase.from('community_reactions').select('target_id, reaction_type')
                    .in('target_id', allIds),
            ])
            : [{ data: [] }, { data: [] }];

        const myReactMap = new Map((myR ?? []).map(r => [r.target_id, r.reaction_type as ReactionType]));

        // Build counts map
        const counts = new Map<string, { parabens: number; arrasou: number; nao_desista: number }>();
        for (const r of (allR ?? [])) {
            const c = counts.get(r.target_id) ?? { parabens: 0, arrasou: 0, nao_desista: 0 };
            (c as Record<string, number>)[r.reaction_type]++;
            counts.set(r.target_id, c);
        }

        const empty = { parabens: 0, arrasou: 0, nao_desista: 0 };
        const items: CommunityFeedItem[] = [
            ...(ws ?? []).map(s => ({
                id: s.id, user_id: s.user_id,
                user_first_name: (nameMap.get(s.user_id) ?? 'Usuário').split(' ')[0],
                activity_type: 'workout' as const,
                duration_minutes: s.duration_minutes,
                total_load_kg: s.total_load_kg,
                created_at: s.created_at,
                reaction_counts: counts.get(s.id) ?? { ...empty },
                my_reaction: myReactMap.get(s.id),
            })),
            ...(cs ?? []).map(s => ({
                id: s.id, user_id: s.user_id,
                user_first_name: (nameMap.get(s.user_id) ?? 'Usuário').split(' ')[0],
                activity_type: 'cardio' as const,
                cardio_type: s.cardio_type,
                duration_minutes: s.duration_minutes,
                distance_km: s.distance_km,
                calories_burned: s.calories_burned,
                created_at: s.created_at,
                reaction_counts: counts.get(s.id) ?? { ...empty },
                my_reaction: myReactMap.get(s.id),
            })),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setFeedItems(items);
    }

    async function loadExplore() {
        const { data: myFollows } = await supabase
            .from('follows').select('following_id, status').eq('follower_id', profile.id);
        const followMap = new Map(myFollows?.map(f => [f.following_id, f.status]) ?? []);

        const { data: profiles } = await supabase
            .from('profiles').select('id, name').neq('id', profile.id).order('name').limit(100);

        setExplore(profiles?.map(p => ({
            id: p.id,
            name: p.name,
            followStatus: followMap.get(p.id) as 'pending' | 'accepted' | undefined,
        })) ?? []);
    }

    async function loadRequests() {
        const { data: reqs } = await supabase
            .from('follows').select('id, follower_id')
            .eq('following_id', profile.id).eq('status', 'pending');

        if (!reqs?.length) {
            setRequests([]); setPending(0); onPendingChange(0); return;
        }

        const { data: reqProfiles } = await supabase
            .from('profiles').select('id, name').in('id', reqs.map(r => r.follower_id));
        const nameMap = new Map(reqProfiles?.map(p => [p.id, p.name]) ?? []);

        const count = reqs.length;
        setPending(count); onPendingChange(count);
        setRequests(reqs.map(r => ({
            id: r.follower_id,
            name: (nameMap.get(r.follower_id) ?? 'Usuário').split(' ')[0],
            follow_id: r.id,
        })));
    }

    async function loadFollowing() {
        const { data: following } = await supabase
            .from('follows').select('id, following_id')
            .eq('follower_id', profile.id).eq('status', 'accepted');

        if (!following?.length) { setFollowing([]); return; }

        const { data: profiles } = await supabase
            .from('profiles').select('id, name').in('id', following.map(f => f.following_id));
        const nameMap = new Map(profiles?.map(p => [p.id, p.name]) ?? []);

        setFollowing(following.map(f => ({
            id: f.following_id,
            name: (nameMap.get(f.following_id) ?? 'Usuário').split(' ')[0],
            follow_id: f.id,
        })));
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    async function handleFollow(userId: string, firstName: string) {
        const { error } = await supabase.from('follows').insert({
            follower_id: profile.id, following_id: userId, status: 'pending',
        });
        if (error) { toast.error('Erro ao enviar solicitação.'); return; }
        setExplore(prev => prev.map(u => u.id === userId ? { ...u, followStatus: 'pending' } : u));
        toast.success(`Solicitação enviada para ${firstName}.`);
    }

    async function handleAccept(req: RequestUser) {
        // Accept the existing request
        await supabase.from('follows').update({ status: 'accepted' }).eq('id', req.follow_id);
        // Create reverse follow (me → requester, mutual)
        await supabase.from('follows').upsert(
            { follower_id: profile.id, following_id: req.id, status: 'accepted' },
            { onConflict: 'follower_id,following_id' }
        );
        setRequests(prev => prev.filter(r => r.id !== req.id));
        const n = Math.max(0, pendingCount - 1);
        setPending(n); onPendingChange(n);
        toast.success(`Agora você e ${req.name} se seguem mutuamente! 🎉`);
    }

    async function handleDecline(req: RequestUser) {
        await supabase.from('follows').delete().eq('id', req.follow_id);
        setRequests(prev => prev.filter(r => r.id !== req.id));
        const n = Math.max(0, pendingCount - 1);
        setPending(n); onPendingChange(n);
    }

    async function handleUnfollow(fu: FollowingUser) {
        await supabase.from('follows').delete().eq('id', fu.follow_id);
        setFollowing(prev => prev.filter(f => f.id !== fu.id));
        toast.success(`Você deixou de seguir ${fu.name}.`);
    }

    async function handleReact(item: CommunityFeedItem, reactionType: ReactionType) {
        const targetType = item.activity_type === 'workout' ? 'workout' : 'cardio';
        if (item.my_reaction === reactionType) {
            await supabase.from('community_reactions').delete()
                .eq('user_id', profile.id).eq('target_id', item.id).eq('target_type', targetType);
        } else {
            await supabase.from('community_reactions').upsert(
                { user_id: profile.id, target_id: item.id, target_type: targetType, reaction_type: reactionType },
                { onConflict: 'user_id,target_id,target_type' }
            );
        }
        setFeedItems(prev => prev.map(fi => {
            if (fi.id !== item.id) return fi;
            const old = fi.my_reaction;
            const next = old === reactionType ? undefined : reactionType;
            const c = { ...fi.reaction_counts };
            if (old)  (c as Record<string, number>)[old]  = Math.max(0, c[old] - 1);
            if (next) (c as Record<string, number>)[next] = (c[next] ?? 0) + 1;
            return { ...fi, my_reaction: next, reaction_counts: c };
        }));
    }

    // ── Render ────────────────────────────────────────────────────────────────

    const filtered = exploreUsers.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const navTabs: { id: HubView; icon: React.ReactNode; label: string; badge?: number }[] = [
        { id: 'feed',      icon: <Activity size={20} />,   label: 'Feed' },
        { id: 'explore',   icon: <Compass size={20} />,    label: 'Explorar' },
        { id: 'requests',  icon: <Bell size={20} />,       label: 'Pedidos', badge: pendingCount },
        { id: 'following', icon: <UserCheck size={20} />,  label: 'Seguindo' },
    ];

    return (
        <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-main)' }}>
            {/* Header */}
            <div
                className="flex items-center gap-3 px-4 pt-14 pb-4 shrink-0"
                style={{ borderBottom: '1px solid var(--border-main)' }}
            >
                <button
                    onClick={onClose}
                    className="p-2 rounded-xl shrink-0"
                    style={{ backgroundColor: 'rgba(var(--text-main-rgb),0.06)' }}
                >
                    <ChevronLeft size={20} />
                </button>
                <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-primary flex items-center gap-1">
                        <Users size={10} /> Social
                    </p>
                    <h2 className="font-bold text-base text-text-main">Comunidade</h2>
                </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto pb-24">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={view}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className="p-4 flex flex-col gap-3"
                    >
                        {loading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 size={28} className="animate-spin text-primary" />
                            </div>
                        ) : (
                            <>
                                {/* ── FEED ── */}
                                {view === 'feed' && (
                                    feedItems.length === 0 ? (
                                        <div className="flex flex-col items-center gap-3 py-20 text-center">
                                            <Users size={48} className="text-text-muted opacity-30" />
                                            <p className="font-semibold text-text-main">Feed vazio</p>
                                            <p className="text-text-muted text-sm max-w-xs">
                                                Siga outras pessoas para ver o progresso delas aqui.
                                            </p>
                                            <button
                                                onClick={() => setView('explore')}
                                                className="mt-2 px-6 py-3 rounded-2xl text-white text-sm font-bold"
                                                style={{ background: 'linear-gradient(135deg, var(--primary), rgba(var(--primary-rgb),0.7))' }}
                                            >
                                                Explorar usuários
                                            </button>
                                        </div>
                                    ) : (
                                        feedItems.map(item => (
                                            <FeedCard key={item.id} item={item} onReact={handleReact} />
                                        ))
                                    )
                                )}

                                {/* ── EXPLORE ── */}
                                {view === 'explore' && (
                                    <>
                                        <div
                                            className="flex items-center gap-2 px-3 py-2 rounded-2xl"
                                            style={{ backgroundColor: 'rgba(var(--text-main-rgb),0.06)', border: '1px solid var(--border-main)' }}
                                        >
                                            <Search size={16} className="text-text-muted shrink-0" />
                                            <input
                                                value={searchQuery}
                                                onChange={e => setSearch(e.target.value)}
                                                placeholder="Buscar por nome..."
                                                className="flex-1 bg-transparent text-sm text-text-main placeholder-text-muted outline-none"
                                            />
                                        </div>
                                        {filtered.length === 0 ? (
                                            <p className="text-center text-text-muted text-sm py-10">
                                                Nenhum usuário encontrado.
                                            </p>
                                        ) : (
                                            filtered.map(u => (
                                                <UserCard
                                                    key={u.id}
                                                    name={u.name.split(' ')[0]}
                                                    action={
                                                        u.followStatus === 'accepted' ? (
                                                            <span className="text-xs text-proteina font-semibold flex items-center gap-1">
                                                                <UserCheck size={13} /> Seguindo
                                                            </span>
                                                        ) : u.followStatus === 'pending' ? (
                                                            <span className="text-xs text-text-muted font-semibold">Solicitado</span>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleFollow(u.id, u.name.split(' ')[0])}
                                                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                                                                style={{ background: 'linear-gradient(135deg, var(--primary), rgba(var(--primary-rgb),0.7))' }}
                                                            >
                                                                <UserPlus size={13} /> Seguir
                                                            </button>
                                                        )
                                                    }
                                                />
                                            ))
                                        )}
                                    </>
                                )}

                                {/* ── REQUESTS ── */}
                                {view === 'requests' && (
                                    requestUsers.length === 0 ? (
                                        <div className="flex flex-col items-center gap-3 py-20 text-center">
                                            <Bell size={48} className="text-text-muted opacity-30" />
                                            <p className="font-semibold text-text-main">Nenhuma solicitação</p>
                                            <p className="text-text-muted text-sm">
                                                Quando alguém quiser te seguir, aparece aqui.
                                            </p>
                                        </div>
                                    ) : (
                                        requestUsers.map(req => (
                                            <div
                                                key={req.id}
                                                className="p-4 rounded-2xl flex items-center gap-3"
                                                style={{ backgroundColor: 'rgba(var(--text-main-rgb),0.04)', border: '1px solid var(--border-main)' }}
                                            >
                                                <AvatarBubble name={req.name} color="var(--accent)" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-text-main text-sm">
                                                        {req.name} quer te seguir
                                                    </p>
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <button
                                                        onClick={() => handleAccept(req)}
                                                        className="p-2 rounded-xl"
                                                        style={{ backgroundColor: 'rgba(var(--primary-rgb),0.15)' }}
                                                        title="Aceitar"
                                                    >
                                                        <Check size={16} className="text-primary" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDecline(req)}
                                                        className="p-2 rounded-xl"
                                                        style={{ backgroundColor: 'rgba(var(--text-main-rgb),0.08)' }}
                                                        title="Recusar"
                                                    >
                                                        <X size={16} className="text-text-muted" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )
                                )}

                                {/* ── FOLLOWING ── */}
                                {view === 'following' && (
                                    followingUsers.length === 0 ? (
                                        <div className="flex flex-col items-center gap-3 py-20 text-center">
                                            <UserCheck size={48} className="text-text-muted opacity-30" />
                                            <p className="font-semibold text-text-main">Você ainda não segue ninguém</p>
                                            <button
                                                onClick={() => setView('explore')}
                                                className="mt-2 px-6 py-3 rounded-2xl text-white text-sm font-bold"
                                                style={{ background: 'linear-gradient(135deg, var(--primary), rgba(var(--primary-rgb),0.7))' }}
                                            >
                                                Explorar usuários
                                            </button>
                                        </div>
                                    ) : (
                                        followingUsers.map(fu => (
                                            <UserCard
                                                key={fu.id}
                                                name={fu.name}
                                                action={
                                                    <button
                                                        onClick={() => handleUnfollow(fu)}
                                                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-text-muted transition-colors"
                                                        style={{ border: '1px solid var(--border-main)' }}
                                                    >
                                                        Seguindo
                                                    </button>
                                                }
                                            />
                                        ))
                                    )
                                )}
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Bottom nav (inside community) */}
            <div
                className="fixed bottom-0 left-0 right-0 z-[110] backdrop-blur-md"
                style={{
                    backgroundColor: 'rgba(var(--bg-main-rgb), 0.95)',
                    borderTop: '1px solid rgba(var(--text-main-rgb), 0.08)',
                }}
            >
                <div className="flex items-center justify-around px-2 py-2">
                    {navTabs.map(tab => {
                        const active = view === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setView(tab.id)}
                                className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl relative"
                                style={{ color: active ? 'var(--primary)' : 'var(--text-muted)' }}
                            >
                                <div className="relative">
                                    {tab.icon}
                                    {tab.badge != null && tab.badge > 0 && (
                                        <span
                                            className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                            style={{ backgroundColor: 'var(--accent)' }}
                                        >
                                            {tab.badge}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] font-medium">{tab.label}</span>
                                {active && (
                                    <motion.div
                                        layoutId="community-nav-indicator"
                                        className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary"
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
