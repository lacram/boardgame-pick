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
    
    // "6|9" 형태 파싱
    if (rangeStr.includes('|')) {
        const parts = rangeStr.split('|').map(s => parseInt(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return searchNum === parts[0] || searchNum === parts[1];
        }
    }
    
    // 단일 숫자
    const num = parseInt(rangeStr);
    if (!isNaN(num)) {
        return searchNum === num;
    }
    
    return false;
}

module.exports = {
    isInRange
};