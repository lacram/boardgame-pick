const supabase = require('../../supabase-client');
const config = require('../../config');

class UserService {
    async listUsers() {
        const { data, error } = await supabase
            .from('app_users')
            .select('id')
            .order('created_at', { ascending: true });

        if (error) throw error;

        return data || [];
    }

    async addUser(userId) {
        const { error } = await supabase
            .from('app_users')
            .insert([{ id: userId }]);

        if (error) throw error;

        return { id: userId };
    }

    async ensureUserExists(userId) {
        const { data, error } = await supabase
            .from('app_users')
            .select('id')
            .eq('id', userId)
            .limit(1);

        if (error) throw error;

        if (!data || data.length === 0) {
            const defaultId = userId || config.reviewUserId;
            await this.addUser(defaultId);
        }
    }

    async getMyPageData(userId) {
        const { data: userRows, error: userError } = await supabase
            .from('user_data')
            .select('bgg_id, is_favorite, is_wishlist, is_owned, is_planned, my_rating')
            .eq('user_id', userId);

        if (userError) throw userError;

        const userData = userRows || [];
        const bggIds = userData.map(row => row.bgg_id);

        if (bggIds.length === 0) {
            return {
                favorites: [],
                owned: [],
                wishlist: [],
                planned: [],
                reviews: []
            };
        }

        const { data: games, error: gameError } = await supabase
            .from('boardgames')
            .select('bgg_id, name, korean_name, main_image_url, url, rating, weight, play_time_min, play_time_max')
            .in('bgg_id', bggIds);

        if (gameError) throw gameError;

        const gameMap = new Map();
        (games || []).forEach(game => {
            gameMap.set(game.bgg_id, {
                ...game,
                displayName: game.korean_name || game.name
            });
        });

        const { data: reviewRows, error: reviewError } = await supabase
            .from('reviews')
            .select('bgg_id, rating, text, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (reviewError) throw reviewError;

        const favorites = [];
        const owned = [];
        const wishlist = [];
        const planned = [];

        userData.forEach(row => {
            const game = gameMap.get(row.bgg_id);
            if (!game) return;

            const item = {
                ...game,
                myRating: row.my_rating || null
            };

            if (row.is_favorite) favorites.push(item);
            if (row.is_owned) owned.push(item);
            if (row.is_wishlist) wishlist.push(item);
            if (row.is_planned) planned.push(item);
        });

        let reviews = (reviewRows || []).map(review => {
            const game = gameMap.get(review.bgg_id);
            if (!game) return null;

            return {
                ...game,
                gameRating: game.rating,
                reviewRating: review.rating,
                text: review.text || '',
                createdAt: review.created_at
            };
        }).filter(Boolean);

        const sortByRatingDesc = (a, b) => {
            const aRating = a.rating || a.gameRating || 0;
            const bRating = b.rating || b.gameRating || 0;
            if (aRating === bRating) return 0;
            return bRating - aRating;
        };

        favorites.sort(sortByRatingDesc);
        owned.sort(sortByRatingDesc);
        wishlist.sort(sortByRatingDesc);
        planned.sort(sortByRatingDesc);
        reviews = reviews.sort((a, b) => (b.reviewRating || 0) - (a.reviewRating || 0));

        return {
            favorites,
            owned,
            wishlist,
            planned,
            reviews
        };
    }
}

module.exports = new UserService();
