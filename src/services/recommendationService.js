const supabase = require('../../supabase-client');
const { parsePlayersToSet } = require('../../utils/searchUtils');

const MAX_SEEDS = 30;
const MAX_TOKENS = 5;
const MAX_CANDIDATES = 300;
const MAX_PAGE_SIZE = 30;
const MIN_CANDIDATE_RATING = 5;

const TOKEN_LABELS = {
    'Card Game': '카드',
    'Economic': '경제',
    'Deck, Bag, and Pool Building': '덱빌딩',
    'Worker Placement': '일꾼 놓기',
    'Tile Placement': '타일 놓기',
    'Cooperative Game': '협력'
};

const COMMA_TOKENS = [
    'Deck, Bag, and Pool Building'
];

function splitTokens(value) {
    let normalized = String(value || '');
    COMMA_TOKENS.forEach(token => {
        normalized = normalized.replaceAll(token, token.replaceAll(',', '[[comma]]'));
    });

    return normalized
        .split(',')
        .map(token => token.replaceAll('[[comma]]', ',').trim())
        .filter(Boolean);
}

function topTokens(rows, field, limit) {
    const counts = new Map();
    rows.forEach(row => {
        splitTokens(row[field]).forEach(token => {
            counts.set(token, (counts.get(token) || 0) + 1);
        });
    });

    return Array.from(counts.entries())
        .sort((a, b) => {
            if (b[1] === a[1]) return a[0].localeCompare(b[0]);
            return b[1] - a[1];
        })
        .slice(0, limit)
        .map(([token]) => token);
}

function tokenLabel(token) {
    return TOKEN_LABELS[token] || token;
}

class RecommendationService {
    constructor(client = supabase) {
        this._supabase = client;
    }

    async getRecommendations(userId, limit = 3) {
        const page = await this.getRecommendationPage(userId, { page: 1, pageSize: limit });
        return page.items;
    }

    async getRecommendationPage(userId, options = {}) {
        const pageSize = this._normalizePageSize(options.pageSize || options.limit || 3);
        const seeds = await this._getPreferenceSeeds(userId);
        if (seeds.length === 0) return this._emptyPage(pageSize);

        const preference = this._buildPreferenceProfile(seeds);
        if (preference.categories.length === 0 && preference.mechanisms.length === 0) {
            return this._emptyPage(pageSize);
        }
        const blockedIds = await this._getBlockedRecommendationIds(userId);
        blockedIds.forEach(id => preference.ownedIds.add(id));

        const candidates = await this._getCandidates();
        const filtered = this._filterCandidates(candidates, preference.seedIds, preference.ownedIds);

        const ranked = filtered
            .map(candidate => this._scoreCandidate(candidate, preference))
            .filter(candidate => candidate.score > 0)
            .sort((a, b) => {
                if (b.score === a.score) return (b.rating || 0) - (a.rating || 0);
                return b.score - a.score;
            })
            .map(candidate => ({
                ...candidate,
                displayName: candidate.korean_name || candidate.name,
                myRating: null
            }));

        return this._paginateRecommendations(ranked, options.page, pageSize);
    }

    async _getPreferenceSeeds(userId) {
        const { data: userRows, error: userError } = await this._supabase
            .from('user_data')
            .select('bgg_id, is_favorite, is_wishlist, is_owned, is_planned, my_rating')
            .eq('user_id', userId)
            .or('my_rating.gte.8,is_favorite.eq.true,is_wishlist.eq.true,is_planned.eq.true')
            .order('my_rating', { ascending: false })
            .limit(MAX_SEEDS);

        if (userError) throw userError;

        const rows = userRows || [];
        if (rows.length === 0) return [];

        const ids = rows.map(row => row.bgg_id);
        const { data: games, error: gameError } = await this._supabase
            .from('boardgames')
            .select('bgg_id, name, korean_name, category, mechanism, weight, rating, players_recommended_raw, players_recommended_set')
            .in('bgg_id', ids);

        if (gameError) throw gameError;

        const userMap = new Map(rows.map(row => [row.bgg_id, row]));
        return (games || [])
            .map(game => ({ ...game, userData: userMap.get(game.bgg_id) }))
            .filter(game => game.userData);
    }

    async _getBlockedRecommendationIds(userId) {
        const { data, error } = await this._supabase
            .from('user_data')
            .select('bgg_id, is_owned, is_recommendation_excluded')
            .eq('user_id', userId)
            .or('is_owned.eq.true,is_recommendation_excluded.eq.true')
            .limit(MAX_CANDIDATES);

        if (error) throw error;
        return new Set((data || []).map(row => row.bgg_id));
    }

    async _getCandidates() {
        const { data, error } = await this._supabase
            .from('boardgames')
            .select('bgg_id, name, korean_name, category, mechanism, weight, rating, main_image_url, url, players_recommended_raw, players_recommended_set')
            .gte('rating', MIN_CANDIDATE_RATING)
            .order('rating', { ascending: false })
            .limit(MAX_CANDIDATES);

        if (error) throw error;
        return data || [];
    }

    _buildPreferenceProfile(seeds) {
        const tokens = this._extractPreferenceTokens(seeds, MAX_TOKENS);
        const weights = seeds
            .map(seed => Number(seed.weight))
            .filter(weight => Number.isFinite(weight) && weight > 0);
        const players = new Set();
        const seedIds = new Set();
        const ownedIds = new Set();

        seeds.forEach(seed => {
            seedIds.add(seed.bgg_id);
            if (seed.userData?.is_owned) ownedIds.add(seed.bgg_id);

            const set = Array.isArray(seed.players_recommended_set)
                ? seed.players_recommended_set
                : parsePlayersToSet(seed.players_recommended_raw || '');
            set.forEach(player => players.add(player));
        });

        return {
            ...tokens,
            averageWeight: weights.length
                ? weights.reduce((sum, weight) => sum + weight, 0) / weights.length
                : null,
            players: Array.from(players),
            seedIds,
            ownedIds
        };
    }

    _extractPreferenceTokens(rows, limit = MAX_TOKENS) {
        return {
            categories: topTokens(rows, 'category', limit),
            mechanisms: topTokens(rows, 'mechanism', limit)
        };
    }

    _filterCandidates(candidates, seedIds, ownedIds, excludedIds = new Set()) {
        return (candidates || []).filter(candidate => {
            return !seedIds.has(candidate.bgg_id)
                && !ownedIds.has(candidate.bgg_id)
                && !excludedIds.has(candidate.bgg_id);
        });
    }

    _normalizePageSize(value) {
        const pageSize = parseInt(value, 10);
        if (!Number.isFinite(pageSize) || pageSize < 1) return 3;
        return Math.min(pageSize, MAX_PAGE_SIZE);
    }

    _normalizePage(value, totalPages) {
        const page = parseInt(value, 10);
        if (!Number.isFinite(page) || page < 1) return 1;
        return ((page - 1) % totalPages) + 1;
    }

    _emptyPage(pageSize) {
        return {
            items: [],
            total: 0,
            page: 1,
            pageSize,
            totalPages: 1,
            nextPage: 1
        };
    }

    _paginateRecommendations(items, requestedPage, pageSize) {
        const total = items.length;
        if (total === 0) return this._emptyPage(pageSize);

        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const page = this._normalizePage(requestedPage, totalPages);
        const start = (page - 1) * pageSize;

        return {
            items: items.slice(start, start + pageSize),
            total,
            page,
            pageSize,
            totalPages,
            nextPage: page >= totalPages ? 1 : page + 1
        };
    }

    _scoreCandidate(candidate, preference) {
        const candidateCategories = splitTokens(candidate.category);
        const candidateMechanisms = splitTokens(candidate.mechanism);
        const categoryMatches = candidateCategories.filter(token => preference.categories.includes(token));
        const mechanismMatches = candidateMechanisms.filter(token => preference.mechanisms.includes(token));

        let score = 0;
        score += categoryMatches.length * 5;
        score += mechanismMatches.length * 8;

        const candidateWeight = Number(candidate.weight);
        let weightClose = false;
        if (preference.averageWeight && Number.isFinite(candidateWeight)) {
            const diff = Math.abs(candidateWeight - preference.averageWeight);
            if (diff <= 0.5) {
                score += 4;
                weightClose = true;
            } else if (diff <= 1) {
                score += 2;
            }
        }

        const playerSet = Array.isArray(candidate.players_recommended_set)
            ? candidate.players_recommended_set
            : parsePlayersToSet(candidate.players_recommended_raw || '');
        const playerOverlap = playerSet.some(player => preference.players.includes(player));
        if (playerOverlap) score += 3;

        score += Math.max(0, Number(candidate.rating) || 0) / 10;

        return {
            ...candidate,
            score,
            reason: this._buildReason({
                categoryMatches,
                mechanismMatches,
                weightClose,
                playerOverlap,
                players: candidate.players_recommended_raw || ''
            })
        };
    }

    _buildReason(parts) {
        const reasons = [];
        const firstMechanism = parts.mechanismMatches[0];
        const firstCategory = parts.categoryMatches[0];

        if (firstMechanism) reasons.push(`${tokenLabel(firstMechanism)} 취향`);
        if (parts.playerOverlap && parts.players) reasons.push(`${parts.players} 구성`);
        if (parts.weightClose) reasons.push('비슷한 난이도');
        if (firstCategory) reasons.push(`${tokenLabel(firstCategory)} 종류`);

        if (reasons.length === 0) return '내 취향 데이터와 가까운 게임이에요';
        if (reasons.length === 1) reasons.push('평점 흐름');
        return `${reasons.slice(0, 2).join('과 ')}이 비슷해요`;
    }
}

module.exports = new RecommendationService();
