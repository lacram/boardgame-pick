/**
 * 검증 미들웨어
 */
const GameValidator = require('../validators/gameValidator');

/**
 * 검색 파라미터 검증 미들웨어
 */
function validateSearchParams(req, res, next) {
    const validation = GameValidator.validateSearchParams(req.query);
    
    if (!validation.isValid) {
        return res.status(400).json({
            error: '잘못된 검색 파라미터입니다.',
            details: validation.errors
        });
    }
    
    next();
}

/**
 * 토글 요청 검증 미들웨어
 */
function validateToggleRequest(req, res, next) {
    const validation = GameValidator.validateToggleRequest(req.body);
    
    if (!validation.isValid) {
        return res.status(400).json({
            error: '잘못된 요청입니다.',
            details: validation.errors
        });
    }
    
    next();
}

/**
 * 리뷰 추가 검증 미들웨어
 */
function validateReviewRequest(req, res, next) {
    const validation = GameValidator.validateReviewRequest(req.body);
    
    if (!validation.isValid) {
        return res.status(400).json({
            error: '잘못된 리뷰 데이터입니다.',
            details: validation.errors
        });
    }
    
    next();
}

/**
 * 리뷰 조회 검증 미들웨어
 */
function validateReviewQuery(req, res, next) {
    const validation = GameValidator.validateReviewQuery(req.query);
    
    if (!validation.isValid) {
        return res.status(400).json({
            error: '잘못된 요청입니다.',
            details: validation.errors
        });
    }
    
    next();
}

module.exports = {
    validateSearchParams,
    validateToggleRequest,
    validateReviewRequest,
    validateReviewQuery
};