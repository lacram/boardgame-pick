const CATEGORY_OPTIONS = [
    { label: '카드', value: 'Card Game' },
    { label: '경제', value: 'Economic' },
    { label: '파티', value: 'Party Game' },
    { label: '추상 전략', value: 'Abstract Strategy' },
    { label: '전쟁', value: 'Wargame' },
    { label: '판타지', value: 'Fantasy' },
    { label: '과학소설', value: 'Science Fiction' },
    { label: '문명', value: 'Civilization' },
    { label: '도시 건설', value: 'City Building' },
    { label: '탐험', value: 'Exploration' },
    { label: '추리/미스터리', value: 'Deduction' },
    { label: '동물', value: 'Animals' }
];

const MECHANISM_OPTIONS = [
    { label: '덱빌딩', value: 'Deck, Bag, and Pool Building' },
    { label: '일꾼 놓기', value: 'Worker Placement' },
    { label: '타일 놓기', value: 'Tile Placement' },
    { label: '협력', value: 'Cooperative Game' },
    { label: '경매', value: 'Auction/Bidding' },
    { label: '주사위', value: 'Dice Rolling' },
    { label: '카드 드래프트', value: 'Card Drafting' },
    { label: '핸드 관리', value: 'Hand Management' },
    { label: '셋 컬렉션', value: 'Set Collection' },
    { label: '영향력/지역 장악', value: 'Area Majority / Influence' },
    { label: '동시 액션 선택', value: 'Simultaneous Action Selection' },
    { label: '블러핑', value: 'Bluffing' }
];

function aliasesFromOptions(options) {
    return options.reduce((aliases, option) => {
        aliases[option.label] = option.value;
        aliases[option.value] = option.value;
        return aliases;
    }, {});
}

const FILTER_ALIASES = {
    category: {
        ...aliasesFromOptions(CATEGORY_OPTIONS),
        '카드게임': 'Card Game'
    },
    mechanism: {
        ...aliasesFromOptions(MECHANISM_OPTIONS),
        '덱 빌딩': 'Deck, Bag, and Pool Building',
        '워커플레이스먼트': 'Worker Placement'
    }
};

function normalizeDiscoveryFilter(kind, value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    return FILTER_ALIASES[kind]?.[trimmed] || trimmed;
}

module.exports = {
    CATEGORY_OPTIONS,
    MECHANISM_OPTIONS,
    normalizeDiscoveryFilter
};
