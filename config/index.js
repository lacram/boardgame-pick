require('dotenv').config();

const config = {
    // 서버 설정
    port: parseInt(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // 페이지네이션 설정
    pageSize: parseInt(process.env.PAGE_SIZE) || 20,
    defaultSortBy: process.env.DEFAULT_SORT_BY || 'rating',
    defaultSortOrder: process.env.DEFAULT_SORT_ORDER || 'desc',
    
    // 캐시 설정
    cacheTtl: parseInt(process.env.CACHE_TTL) || 5 * 60 * 1000, // 5분
    
    // Supabase 설정
    supabase: {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY
    }
};

// 필수 환경 변수 검증
const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error('필수 환경 변수가 설정되지 않았습니다:', missingEnvVars);
    process.exit(1);
}

module.exports = config;