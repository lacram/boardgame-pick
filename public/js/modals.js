// Modal functionality for rating and review

function openRatingModal(bggId) {
    currentBggId = bggId;
    const button = event.target;
    currentGameName = button.getAttribute('data-game-name');
    
    selectedRating = 0;
    document.getElementById('reviewText').value = '';
    updateStarDisplay();

    document.getElementById('ratingModal').style.display = 'block';

    fetch(`/get-review?bggId=${bggId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.review) {
                selectedRating = data.review.rating || 0;
                document.getElementById('reviewText').value = data.review.text || '';
                updateStarDisplay();
            }
        })
        .catch(error => {
            console.error('기존 리뷰 조회 에러:', error);
        });
}

function closeRatingModal() {
    document.getElementById('ratingModal').style.display = 'none';
}

function updateStarDisplay() {
    const stars = document.querySelectorAll('.star');
    const ratingText = document.getElementById('ratingText');
    
    stars.forEach((star, index) => {
        const rating = index + 1;
        if (rating <= selectedRating) {
            star.classList.add('active');
            star.textContent = '★';
        } else {
            star.classList.remove('active');
            star.textContent = '☆';
        }
    });
    
    if (selectedRating > 0) {
        ratingText.textContent = `${selectedRating}점을 선택했습니다`;
    } else {
        ratingText.textContent = '별점을 선택해주세요';
    }
}

function selectRating(rating) {
    selectedRating = rating;
    updateStarDisplay();
}

function saveRating() {
    if (selectedRating === 0) {
        alert('별점을 선택해주세요');
        return;
    }

    const reviewText = document.getElementById('reviewText').value;

    fetch('/add-review', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            bggId: currentBggId,
            rating: selectedRating,
            text: reviewText
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            closeRatingModal();
            const ratingEl = document.getElementById(`myRating-${currentBggId}`);
            if (ratingEl) ratingEl.textContent = selectedRating;

            const reviewButton = document.getElementById(`reviewButton-${currentBggId}`);
            if (reviewButton) reviewButton.style.display = 'inline-flex';

            alert('평점이 저장되었습니다!');
        }
    })
    .catch(error => {
        console.error('평점 저장 에러:', error);
        alert('평점 저장 중 오류가 발생했습니다.');
    });
}

function openReviewModal(bggId) {
    fetch(`/get-review?bggId=${bggId}`)
    .then(response => response.json())
    .then(data => {
        if (data.success && data.review) {
            document.getElementById('reviewRatingDisplay').textContent = `${data.review.rating}점`;
            document.getElementById('reviewTextDisplay').textContent = data.review.text || '리뷰가 없습니다.';
            document.getElementById('reviewModal').style.display = 'block';
        } else {
            alert('리뷰를 찾을 수 없습니다.');
        }
    })
    .catch(error => {
        console.error('리뷰 조회 에러:', error);
        alert('리뷰 조회 중 오류가 발생했습니다.');
    });
}

function closeReviewModal() {
    document.getElementById('reviewModal').style.display = 'none';
}
