const SORT_FIELDS = Object.freeze([
    'rating',
    'myRating',
    'weight',
    'name',
    'players_recommended',
    'play_time_min'
]);

const SORT_ORDERS = Object.freeze(['asc', 'desc']);

function normalizeSortBy(value, fallback = 'rating') {
    return SORT_FIELDS.includes(value) ? value : fallback;
}

function normalizeSortOrder(value, fallback = 'desc') {
    return SORT_ORDERS.includes(value) ? value : fallback;
}

function isValidSortBy(value) {
    return value === undefined || value === '' || SORT_FIELDS.includes(value);
}

function isValidSortOrder(value) {
    return value === undefined || value === '' || SORT_ORDERS.includes(value);
}

function isMissingMyRatingRpc(error) {
    if (!error) return false;
    return error.code === 'PGRST202'
        || error.code === '42883'
        || /could not find the function|get_boardgames_sorted_by_my_rating|does not exist/i.test(error.message || '');
}

module.exports = {
    SORT_FIELDS,
    SORT_ORDERS,
    normalizeSortBy,
    normalizeSortOrder,
    isValidSortBy,
    isValidSortOrder,
    isMissingMyRatingRpc
};
