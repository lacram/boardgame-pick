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

    // Scheduled buttons
    const scheduledButtons = document.querySelectorAll('.scheduled-button');
    scheduledButtons.forEach(button => {
        button.addEventListener('click', function() {
            const rowId = this.getAttribute('data-rowid');
            const currentScheduled = this.getAttribute('data-scheduled');
            toggleScheduled(this, parseInt(rowId), parseInt(currentScheduled));
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