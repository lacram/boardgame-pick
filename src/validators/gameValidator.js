/**
 * 게임 관련 입력값 검증 유틸리티
 */

class GameValidator {
    /**
     * 검색 파라미터 검증
     */
    static validateSearchParams(query) {
        const errors = [];

        // 페이지 번호 검증
        if (query.page && !this._isPositiveInteger(query.page)) {
            errors.push('페이지 번호는 양의 정수여야 합니다.');
        }

        // 무게 범위 검증
        if (query.weightMin && !this._isValidWeight(query.weightMin)) {
            errors.push('최소 난이도는 0-5 사이의 숫자여야 합니다.');
        }

        if (query.weightMax && !this._isValidWeight(query.weightMax)) {
            errors.push('최대 난이도는 0-5 사이의 숫자여야 합니다.');
        }

        if (query.weightMin && query.weightMax) {
            const min = parseFloat(query.weightMin);
            const max = parseFloat(query.weightMax);
            if (min > max) {
                errors.push('최소 난이도는 최대 난이도보다 작아야 합니다.');
            }
        }

        // 검색어 길이 검증
        if (query.search && query.search.length > 100) {
            errors.push('검색어는 100자를 초과할 수 없습니다.');
        }

        // 인원수 검색 검증
        if (query.searchPlayers && !this._isValidPlayerSearch(query.searchPlayers)) {
            errors.push('인원수 검색은 올바른 형식이어야 합니다. (예: 2, 2-4, 3|5)');
        }

        if (query.searchBest && !this._isValidPlayerSearch(query.searchBest)) {
            errors.push('베스트 인원 검색은 올바른 형식이어야 합니다. (예: 2, 2-4, 3|5)');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 즐겨찾기/플레이 예정 토글 검증
     */
    static validateToggleRequest(body) {
        const errors = [];

        if (!body.rowId) {
            errors.push('게임 ID가 필요합니다.');
        } else if (!this._isPositiveInteger(body.rowId)) {
            errors.push('게임 ID는 양의 정수여야 합니다.');
        }

        if (body.currentFav === undefined && body.currentScheduled === undefined) {
            errors.push('현재 상태값이 필요합니다.');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 리뷰 추가 검증
     */
    static validateReviewRequest(body) {
        const errors = [];

        if (!body.bggId) {
            errors.push('게임 ID가 필요합니다.');
        } else if (!this._isPositiveInteger(body.bggId)) {
            errors.push('게임 ID는 양의 정수여야 합니다.');
        }

        if (!body.rating) {
            errors.push('평점이 필요합니다.');
        } else if (!this._isValidRating(body.rating)) {
            errors.push('평점은 1-10 사이의 정수여야 합니다.');
        }

        if (body.text && body.text.length > 1000) {
            errors.push('리뷰 텍스트는 1000자를 초과할 수 없습니다.');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 리뷰 조회 검증
     */
    static validateReviewQuery(query) {
        const errors = [];

        if (!query.bggId) {
            errors.push('게임 ID가 필요합니다.');
        } else if (!this._isPositiveInteger(query.bggId)) {
            errors.push('게임 ID는 양의 정수여야 합니다.');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Private helper methods

    static _isPositiveInteger(value) {
        const num = parseInt(value);
        return Number.isInteger(num) && num > 0;
    }

    static _isValidWeight(value) {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0 && num <= 5;
    }

    static _isValidRating(value) {
        const num = parseInt(value);
        return Number.isInteger(num) && num >= 1 && num <= 10;
    }

    static _isValidPlayerSearch(value) {
        if (!value || typeof value !== 'string') return false;
        
        // 숫자만 (예: "2")
        if (/^\d+$/.test(value)) return true;
        
        // 범위 (예: "2-4")
        if (/^\d+-\d+$/.test(value)) {
            const [min, max] = value.split('-').map(n => parseInt(n));
            return min > 0 && max > 0 && min <= max && max <= 20;
        }
        
        // 또는 (예: "3|5")
        if (/^\d+\|\d+$/.test(value)) {
            const [num1, num2] = value.split('|').map(n => parseInt(n));
            return num1 > 0 && num2 > 0 && num1 <= 20 && num2 <= 20;
        }
        
        return false;
    }
}

module.exports = GameValidator;