const express = require('express');
const path = require('path');
const config = require('../config');

// 미들웨어
const { cacheMiddleware, destroyCache } = require('../src/middleware/cacheMiddleware');
const { notFoundHandler, errorHandler } = require('../src/middleware/errorMiddleware');
const { userMiddleware } = require('../src/middleware/userMiddleware');

// 라우터
const gameRoutes = require('../src/routes/gameRoutes');

const app = express();

// 기본 미들웨어 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 커스텀 미들웨어
app.use(cacheMiddleware);
app.use(userMiddleware);

// 라우터 연결
app.use('/', gameRoutes);

// 에러 처리 미들웨어
app.use(notFoundHandler);
app.use(errorHandler);

// Vercel 서버리스 함수로 export
module.exports = app;

// 로컬 개발용 서버 시작
if (config.nodeEnv !== 'production' || process.env.VERCEL !== '1') {
    app.listen(config.port, () => {
        console.log(`서버가 http://localhost:${config.port} 에서 실행 중입니다.`);
        console.log(`환경: ${config.nodeEnv}`);
    });
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('서버 종료 중...');
    destroyCache();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('서버 종료 중...');
    destroyCache();
    process.exit(0);
});
