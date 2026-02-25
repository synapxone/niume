import { supabase } from '../lib/supabase';

// Cache the blocklist to avoid repeated DB queries
let blocklistCache: string[] | null = null;
let blocklistLoadedAt = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getBlocklist(): Promise<string[]> {
    const now = Date.now();
    if (blocklistCache && now - blocklistLoadedAt < CACHE_TTL) {
        return blocklistCache;
    }
    try {
        const { data } = await supabase.from('content_blocklist').select('word');
        blocklistCache = data?.map(r => r.word.toLowerCase()) ?? [];
        blocklistLoadedAt = now;
    } catch {
        blocklistCache = blocklistCache ?? [];
    }
    return blocklistCache;
}

export type ModerationResult =
    | { ok: true }
    | { ok: false; reason: string };

/**
 * Two-layer content moderation:
 * 1. Local blocklist check (fast, no AI cost)
 * 2. AI context check via edge function (only if blocklist passes)
 */
export async function moderateContent(
    input: string,
    context: 'exercício' | 'modalidade' = 'exercício'
): Promise<ModerationResult> {
    const lower = input.toLowerCase().trim();

    if (!lower || lower.length < 2) {
        return { ok: false, reason: 'O nome precisa ter pelo menos 2 caracteres.' };
    }
    if (lower.length > 60) {
        return { ok: false, reason: 'O nome não pode ter mais de 60 caracteres.' };
    }

    // Layer 1: blocklist
    const blocklist = await getBlocklist();
    const blocked = blocklist.find(w => lower.includes(w));
    if (blocked) {
        return { ok: false, reason: `O nome contém um termo não permitido.` };
    }

    // Layer 2: AI context check (best-effort, fail open)
    try {
        const { data, error } = await supabase.functions.invoke('ai-service', {
            body: {
                action: 'MODERATE_CONTENT',
                payload: { input, context }
            }
        });
        if (!error && data?.result === 'BLOQUEADO') {
            return { ok: false, reason: data.reason || 'Conteúdo não permitido em um app fitness.' };
        }
    } catch {
        // Fail open — if AI check unavailable, allow content
    }

    return { ok: true };
}
