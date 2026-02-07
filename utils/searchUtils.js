/**
 * 검색값이 범위에 포함되는지 확인하는 함수
 * @param {string} searchValue - 검색할 값
 * @param {string} rangeStr - 범위 문자열 (예: "2-4", "3|5")
 * @returns {boolean} - 포함 여부
 */
function isInRange(searchValue, rangeStr) {
    if (!rangeStr) return false;
    
    const searchNum = parseInt(searchValue);
    if (isNaN(searchNum)) return false;
    
    // "6-9" 형태 파싱 (하이픈, en dash, em dash 모두 지원)
    if (rangeStr.includes('-') || rangeStr.includes('–') || rangeStr.includes('—')) {
        // 모든 종류의 대시를 일반 하이픈으로 변환
        const normalizedRange = rangeStr.replace(/[–—]/g, '-');
        const parts = normalizedRange.split('-').map(s => parseInt(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return searchNum >= parts[0] && searchNum <= parts[1];
        }
    }
    
    // "6|9" 또는 "6,9" 형태 파싱
    if (rangeStr.includes('|') || rangeStr.includes(',')) {
        const parts = rangeStr.split(/[|,]/).map(s => parseInt(s.trim()));
        const valid = parts.filter(n => !isNaN(n));
        if (valid.length > 0) {
            return valid.includes(searchNum);
        }
    }
    
    // 단일 숫자
    const num = parseInt(rangeStr);
    if (!isNaN(num)) {
        return searchNum === num;
    }
    
    return false;
}

/**
 * 인원수 문자열을 정규화된 set 배열로 변환
 * @param {string} value - "2-4", "3|5", "4,6", "2-4,6" 등
 * @returns {number[]} - 중복 제거된 정수 배열 (오름차순)
 */
function parsePlayersToSet(value) {
    if (!value) return [];

    const normalized = value.replace(/[–—~]/g, '-').trim();
    if (!normalized) return [];

    const result = new Set();
    const tokens = normalized.split(/[|,]/).map(token => token.trim()).filter(Boolean);

    for (const token of tokens.length > 0 ? tokens : [normalized]) {
        if (token.includes('-')) {
            const parts = token.split('-').map(s => parseInt(s.trim()));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                const start = Math.min(parts[0], parts[1]);
                const end = Math.max(parts[0], parts[1]);
                for (let i = start; i <= end; i += 1) {
                    result.add(i);
                }
                continue;
            }
        }

        const num = parseInt(token);
        if (!isNaN(num)) {
            result.add(num);
        }
    }

    return Array.from(result).sort((a, b) => a - b);
}

module.exports = {
    isInRange,
    parsePlayersToSet
};
