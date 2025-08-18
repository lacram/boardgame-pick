/**
 * 캐시 미들웨어 - 요청 객체에 캐시 인스턴스를 주입
 */
const MemoryCache = require('../../utils/cache');
const config = require('../../config');

// 전역 캐시 인스턴스 생성
const cache = new MemoryCache(config.cacheTtl);

function cacheMiddleware(req, res, next) {
    // 요청 객체에 캐시 인스턴스 추가
    req.cache = cache;
    next();
}

// Graceful shutdown을 위한 캐시 정리 함수
function destroyCache() {
    cache.destroy();
}

module.exports = {
    cacheMiddleware,
    destroyCache
};