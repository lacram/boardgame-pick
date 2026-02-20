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
