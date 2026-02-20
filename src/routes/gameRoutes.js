const express = require('express');
const gameController = require('../controllers/gameController');
const userController = require('../controllers/userController');
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

// 위시리스트 토글
router.post('/toggle-wishlist', 
    validateToggleRequest,
    asyncHandler(gameController.toggleWishlist.bind(gameController))
);

// 플레이 예정 토글
router.post('/toggle-planned', 
    validateToggleRequest,
    asyncHandler(gameController.togglePlanned.bind(gameController))
);

// 보유 토글
router.post('/toggle-owned', 
    validateToggleRequest,
    asyncHandler(gameController.toggleOwned.bind(gameController))
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

// 유저 목록
router.get('/users', 
    asyncHandler(userController.listUsers.bind(userController))
);

// 유저 추가
router.post('/users/add', 
    asyncHandler(userController.addUser.bind(userController))
);

// 유저 변경
router.post('/users/select', 
    asyncHandler(userController.selectUser.bind(userController))
);

// 마이페이지
router.get('/mypage',
    asyncHandler(userController.myPage.bind(userController))
);

module.exports = router;
