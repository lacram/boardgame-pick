const express = require('express');
const gameController = require('../controllers/gameController');
const { asyncHandler } = require('../middleware/errorMiddleware');
const {
    validateSearchParams,
    validateToggleRequest,
    validateReviewRequest,
    validateReviewQuery
} = require('../middleware/validationMiddleware');

const router = express.Router();

// 메인 페이지
router.get('/', 
    validateSearchParams,
    asyncHandler(gameController.index.bind(gameController))
);

// 즐겨찾기 토글
router.post('/toggle-favorite', 
    validateToggleRequest,
    asyncHandler(gameController.toggleFavorite.bind(gameController))
);

// 플레이 예정 토글
router.post('/toggle-scheduled', 
    validateToggleRequest,
    asyncHandler(gameController.toggleScheduled.bind(gameController))
);

// 리뷰 추가
router.post('/add-review', 
    validateReviewRequest,
    asyncHandler(gameController.addReview.bind(gameController))
);

// 리뷰 조회
router.get('/get-review', 
    validateReviewQuery,
    asyncHandler(gameController.getReview.bind(gameController))
);

module.exports = router;