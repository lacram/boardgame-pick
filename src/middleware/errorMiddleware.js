/**
 * 에러 처리 미들웨어
 */

/**
 * 404 에러 처리
 */
function notFoundHandler(req, res, next) {
    const error = new Error(`경로를 찾을 수 없습니다: ${req.originalUrl}`);
    error.status = 404;
    next(error);
}

/**
 * 전역 에러 처리
 */
function errorHandler(error, req, res, next) {
    const status = error.status || 500;
    const message = error.message || '내부 서버 오류가 발생했습니다.';
    
    // 에러 로깅
    console.error(`[${new Date().toISOString()}] ${status} - ${message}`);
    console.error(error.stack);

    // JSON 요청인 경우 JSON 응답
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(status).json({
            error: message,
            status
        });
    }

    // 404 페이지는 메인 페이지로 리다이렉트
    if (status === 404) {
        return res.redirect('/');
    }

    // 기타 에러는 에러 페이지 렌더링
    res.status(status).render('error', {
        message,
        status,
        error: process.env.NODE_ENV === 'development' ? error : {}
    });
}

/**
 * 비동기 에러 캐처
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    notFoundHandler,
    errorHandler,
    asyncHandler
};