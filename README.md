# Boardgame Pick

한국어 보드게임 추천 웹 애플리케이션

## 기능

- 📋 BoardGameGeek 데이터 기반 보드게임 검색 및 필터링
- ⭐ 즐겨찾기 관리
- ◆ 플레이 예정 관리
- 📦 보유 게임 관리
- 👥 인원수별 검색 (복잡한 범위 검색 지원: "2-4", "3|5")
- 🎯 난이도(Weight) 필터링
- 📝 개인 평점 및 리뷰 시스템
- 👤 간단 유저 전환 (유저별 즐겨찾기/위시리스트/보유/플레이 예정/내 평점)
- 📱 반응형 디자인

## 기술 스택

- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **Frontend**: EJS, Vanilla JavaScript
- **Deployment**: Vercel
- **Data Source**: BoardGameGeek API

## 설치 및 실행

### 1. 저장소 복제

```bash
git clone <repository-url>
cd boardgame-pick
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

`.env.example` 파일을 복사하여 `.env` 파일을 생성하고 값을 설정하세요:

```bash
cp .env.example .env
```

필수 환경 변수:
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_ANON_KEY`: Supabase Anonymous Key
- `COOKIE_SECRET`: 공유 프로필 쿠키/CSRF 서명용 긴 무작위 문자열(production 필수)
- `CRON_SECRET`: Vercel Cron 보호용 긴 무작위 문자열(production 및 크론 사용 시 필수)

> 현재 유저 전환은 **공유 로컬 프로필** 기능입니다. 로그인/인가가 적용된 공개 멀티유저 계정이 아니므로, 사용자별 데이터 보호가 필요한 공개 서비스로 운영하려면 Supabase Auth/RLS와 기존 `bgp_user` 데이터 claim/import 마이그레이션을 별도 도입해야 합니다.

### 4. 데이터베이스 설정

Supabase에서 다음 SQL을 실행하여 스키마를 생성하세요:

```sql
-- 플레이 예정 컬럼 추가
ALTER TABLE boardgames ADD COLUMN is_scheduled BOOLEAN DEFAULT FALSE;

-- 보유 컬럼 추가
ALTER TABLE boardgames ADD COLUMN is_owned BOOLEAN DEFAULT FALSE;

-- 유저 목록 테이블
CREATE TABLE IF NOT EXISTS app_users (
    id text PRIMARY KEY,
    created_at timestamptz DEFAULT now()
);

-- 유저별 데이터 테이블
CREATE TABLE IF NOT EXISTS user_data (
    id bigserial PRIMARY KEY,
    user_id text NOT NULL,
    bgg_id int NOT NULL,
    is_favorite boolean DEFAULT false,
    is_wishlist boolean DEFAULT false,
    is_owned boolean DEFAULT false,
    is_planned boolean DEFAULT false,
    my_rating int,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_data_user_bgg
    ON user_data(user_id, bgg_id);

-- 기존 is_scheduled 데이터가 있다면 위시리스트로 이관
-- UPDATE user_data SET is_wishlist = is_scheduled WHERE is_scheduled = true;

-- 인덱스 생성 (성능 최적화)
-- database_indexes.sql 파일의 내용을 실행
```

### 5. 개발 서버 실행

```bash
npm run dev  # 개발용 (nodemon)
npm start    # 프로덕션용
```

## 프로젝트 구조

```
boardgame-pick/
├── api/
│   └── index.js             # 메인 서버 파일
├── src/                     # 소스 코드
│   ├── controllers/         # HTTP 요청/응답 처리
│   │   ├── cronController.js
│   │   ├── gameController.js
│   │   └── userController.js
│   ├── services/           # 비즈니스 로직
│   │   ├── bggSyncService.js
│   │   ├── gameService.js
│   │   └── userService.js
│   ├── middleware/         # 커스텀 미들웨어
│   │   ├── cacheMiddleware.js
│   │   ├── errorMiddleware.js
│   │   ├── userMiddleware.js
│   │   └── validationMiddleware.js
│   ├── validators/         # 입력 검증
│   │   └── gameValidator.js
│   ├── routes/            # 라우터
│   │   └── gameRoutes.js
├── public/                # 정적 파일
│   ├── css/
│   │   └── styles.css     # 메인 스타일시트
│   ├── images/            # 런타임 UI 아이콘
│   ├── icons/             # UI 시안용 아이콘
│   ├── ui-preview.html    # UI 시안 미리보기
│   └── js/                # 클라이언트 스크립트
│       ├── main.js
│       ├── modals.js
│       ├── toggles.js
│       └── users.js
├── config/
│   └── index.js           # 환경 설정
├── utils/
│   ├── cache.js           # 캐시 유틸리티
│   └── searchUtils.js     # 검색 유틸리티
├── views/                 # EJS 템플릿
│   ├── index.ejs          # 메인 페이지
│   ├── mypage.ejs         # 유저별 저장 게임/리뷰 페이지
│   └── error.ejs          # 에러 페이지
├── scripts/               # Supabase/BGG 운영 스크립트
│   ├── backfill-players-sets.js
│   ├── sync-bgg-details.js
│   └── sync-bgg-dump.js
├── supabase-client.js     # Supabase 클라이언트
├── database_indexes.sql   # 데이터베이스 인덱스
├── vercel.json           # Vercel 배포 설정
├── AGENTS.md             # Codex 작업 지침
└── CLAUDE.md             # AI 개발 가이드
```

## 배포

이 프로젝트는 Vercel에서 서버리스 함수로 배포됩니다.

1. Vercel CLI 설치: `npm i -g vercel`
2. 프로젝트 배포: `vercel`
3. 환경 변수를 Vercel 대시보드에서 설정

### 배포 전 보안 체크리스트

- Vercel 환경 변수에 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `COOKIE_SECRET`, `CRON_SECRET`을 설정합니다.
- Vercel Cron은 `CRON_SECRET`이 설정되면 `Authorization: Bearer <CRON_SECRET>` 헤더를 자동 전송합니다. 서버는 secret 누락/불일치 시 동기화를 거부합니다.
- `npm run audit`로 production 의존성 HIGH 취약점이 0인지 확인합니다.
- `npm run check`와 `npm test`를 실행합니다.
- 배포 후 주요 화면, 검색, 프로필 전환, 토글, 리뷰 저장, 크론 403/성공 케이스를 smoke test합니다.

## 개발 가이드

### 캐시 시스템

- 메모리 기반 캐시 (기본 5분 TTL)
- 자동 정리 기능 (10분 주기)
- 게임 데이터 변경 시 자동 캐시 무효화

### 검색 기능

복잡한 인원수 범위 검색 지원:
- `"2"` - 정확히 2명
- `"2-4"` - 2명에서 4명까지
- `"3|5"` - 3명 또는 5명

### 성능 최적화

- 선택적 컬럼 로딩
- N+1 쿼리 방지
- 복합 인덱스 활용
- 메모리 캐시 시스템

## 기여

1. Fork 프로젝트
2. Feature 브랜치 생성 (`git checkout -b feature/AmazingFeature`)
3. 변경사항 커밋 (`git commit -m 'Add AmazingFeature'`)
4. 브랜치에 Push (`git push origin feature/AmazingFeature`)
5. Pull Request 생성

## 라이선스

MIT License
