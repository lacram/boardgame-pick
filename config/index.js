require('dotenv').config();

function parseInteger(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    if (!/^\d+$/.test(String(value))) return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

const config = {
    // 서버 설정
    port: parseInteger(process.env.PORT, 3000),
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // 페이지네이션 설정
    pageSize: parseInteger(process.env.PAGE_SIZE, 18),
    defaultSortBy: process.env.DEFAULT_SORT_BY || 'rating',
    defaultSortOrder: process.env.DEFAULT_SORT_ORDER || 'desc',
    
    // 캐시 설정
    cacheTtl: parseInteger(process.env.CACHE_TTL, 5 * 60 * 1000), // 5분
    
    // Supabase 설정
    supabase: {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY
    },

    // 리뷰 설정 (단일 사용자 기본값)
    reviewUserId: process.env.REVIEW_USER_ID || 'local-user',

    // 크론/동기화 설정
    cron: {
        secret: process.env.CRON_SECRET || '',
        defaultSyncLimit: parseInteger(process.env.BGG_DETAIL_SYNC_LIMIT, 200),
        maxSyncLimit: parseInteger(process.env.BGG_DETAIL_MAX_SYNC_LIMIT, 500)
    },

    // 보안/공유 로컬 프로필 설정
    security: {
        cookieSecret: process.env.COOKIE_SECRET || process.env.SESSION_SECRET || (
            process.env.NODE_ENV === 'production' ? '' : 'development-cookie-secret'
        ),
        csrfCookieName: 'bgp_csrf',
        csrfHeaderName: 'x-csrf-token',
        localProfileMode: process.env.LOCAL_PROFILE_MODE !== 'false',
        publicMultiuser: process.env.PUBLIC_MULTIUSER === 'true',
        secureCookies: process.env.NODE_ENV === 'production'
    }
};

// 필수 환경 변수 검증
const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
];

if (config.nodeEnv === 'production') {
    requiredEnvVars.push('CRON_SECRET');
}

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (config.nodeEnv === 'production' && !config.security.cookieSecret) {
    missingEnvVars.push('COOKIE_SECRET 또는 SESSION_SECRET');
}

if (config.nodeEnv !== 'test' && missingEnvVars.length > 0) {
    console.error('필수 환경 변수가 설정되지 않았습니다:', missingEnvVars);
    process.exit(1);
}

module.exports = config;
