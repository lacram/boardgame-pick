// Boardgame Pick - Main JavaScript

// Global variables
let currentBggId = null;
let currentGameName = null;
let selectedRating = 0;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    initializeModals();
});

function initializeEventListeners() {
    initializeSearchSubmitShortcut();
    initializeSearchPendingState();
    initializeRecommendationPager();

    // Favorite buttons
    const favoriteButtons = document.querySelectorAll('.favorite-button');
    favoriteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const rowId = this.getAttribute('data-rowid');
            const currentFav = this.getAttribute('data-favorite');
            toggleFavorite(this, parseInt(rowId), parseInt(currentFav));
        });
    });

    // Wishlist buttons
    const wishlistButtons = document.querySelectorAll('.wishlist-button');
    wishlistButtons.forEach(button => {
        button.addEventListener('click', function() {
            const rowId = this.getAttribute('data-rowid');
            const currentWishlist = this.getAttribute('data-wishlist');
            toggleWishlist(this, parseInt(rowId), parseInt(currentWishlist));
        });
    });

    // Planned buttons
    const plannedButtons = document.querySelectorAll('.planned-button');
    plannedButtons.forEach(button => {
        button.addEventListener('click', function() {
            const rowId = this.getAttribute('data-rowid');
            const currentPlanned = this.getAttribute('data-planned');
            togglePlanned(this, parseInt(rowId), parseInt(currentPlanned));
        });
    });

    // Owned buttons
    const ownedButtons = document.querySelectorAll('.owned-button');
    ownedButtons.forEach(button => {
        button.addEventListener('click', function() {
            const rowId = this.getAttribute('data-rowid');
            const currentOwned = this.getAttribute('data-owned');
            toggleOwned(this, parseInt(rowId), parseInt(currentOwned));
        });
    });
}

function initializeRecommendationPager() {
    const button = document.getElementById('recommendationNextButton');
    const strip = document.querySelector('.recommendation-strip');
    if (!button || !strip) return;

    button.addEventListener('click', async function() {
        const page = parseInt(button.dataset.nextPage || '1', 10);
        const limit = parseInt(button.dataset.pageSize || '3', 10);

        button.disabled = true;
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(limit)
            });
            const response = await fetch(`/recommendations?${params.toString()}`, {
                headers: { Accept: 'application/json' }
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || '추천 게임을 불러오지 못했습니다.');
            }

            renderRecommendationCards(strip, data.items || []);
            button.dataset.nextPage = String(data.nextPage || 1);
        } catch (error) {
            console.error('추천 게임 페이지 이동 오류:', error);
        } finally {
            button.disabled = false;
        }
    });
}

function renderRecommendationCards(strip, games) {
    strip.textContent = '';

    games.forEach(game => {
        const card = document.createElement('a');
        card.href = game.url || '#';
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.className = 'recommendation-card';

        if (game.main_image_url) {
            const image = document.createElement('img');
            image.src = game.main_image_url;
            image.alt = game.displayName || game.name || '추천 게임';
            image.className = 'recommendation-image';
            image.loading = 'lazy';
            image.decoding = 'async';
            image.width = 180;
            image.height = 120;
            card.appendChild(image);
        }

        const body = document.createElement('div');
        body.className = 'recommendation-body';

        const title = document.createElement('div');
        title.className = 'recommendation-title';
        title.textContent = game.displayName || game.name || '이름 없는 게임';

        const meta = document.createElement('div');
        meta.className = 'recommendation-meta';
        meta.textContent = `🌟 ${game.rating || 0} | 난이도 ${game.weight || 0}`;

        const reason = document.createElement('div');
        reason.className = 'recommendation-reason';
        reason.textContent = game.reason || '내 취향 데이터와 가까운 게임이에요';

        body.append(title, meta, reason);
        card.appendChild(body);
        strip.appendChild(card);
    });
}

function initializeSearchPendingState() {
    const searchForm = document.querySelector('.search-form');
    if (!searchForm) return;

    searchForm.addEventListener('submit', function() {
        const submitButton = searchForm.querySelector('.search-button');
        searchForm.setAttribute('aria-busy', 'true');
        searchForm.classList.add('is-submitting');

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.dataset.originalText = submitButton.textContent;
            submitButton.textContent = '검색 중...';
        }
    });
}

function initializeSearchSubmitShortcut() {
    const searchInput = document.querySelector('.search-form input[name="search"]');
    if (!searchInput || !searchInput.form) return;

    searchInput.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter') return;

        event.preventDefault();
        if (typeof searchInput.form.requestSubmit === 'function') {
            searchInput.form.requestSubmit();
            return;
        }
        searchInput.form.submit();
    });
}

function initializeModals() {
    // Rating modal outside click handler
    const ratingModal = document.getElementById('ratingModal');
    if (ratingModal) {
        ratingModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeRatingModal();
            }
        });
    }

    // Review modal outside click handler
    const reviewModal = document.getElementById('reviewModal');
    if (reviewModal) {
        reviewModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeReviewModal();
            }
        });
    }
}
