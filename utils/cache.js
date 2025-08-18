class MemoryCache {
    constructor(ttl = 5 * 60 * 1000) { // 기본 5분
        this.cache = new Map();
        this.ttl = ttl;
        
        // 캐시 정리 함수 (10분마다 실행)
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 10 * 60 * 1000);
    }
    
    /**
     * 캐시에서 값 가져오기
     * @param {string} key - 캐시 키
     * @returns {any|null} - 캐시된 값 또는 null
     */
    get(key) {
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.ttl) {
            return cached.data;
        }
        
        // 만료된 항목 삭제
        if (cached) {
            this.cache.delete(key);
        }
        
        return null;
    }
    
    /**
     * 캐시에 값 저장
     * @param {string} key - 캐시 키
     * @param {any} data - 저장할 데이터
     */
    set(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
    
    /**
     * 캐시 초기화
     */
    clear() {
        this.cache.clear();
    }
    
    /**
     * 만료된 캐시 항목 정리
     */
    cleanup() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.ttl) {
                this.cache.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`캐시 정리 완료: ${cleanedCount}개 항목 삭제`);
        }
    }
    
    /**
     * 캐시 통계 정보
     */
    getStats() {
        return {
            size: this.cache.size,
            ttl: this.ttl
        };
    }
    
    /**
     * 캐시 정리 인터벌 해제
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clear();
    }
}

module.exports = MemoryCache;