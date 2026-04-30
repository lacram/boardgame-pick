# 프로젝트 정리 및 구조 개선 계획

작성일: 2026-04-29  
목표: 프로젝트 동작에 영향을 주지 않는 범위에서 불필요한 파일을 식별하고, 삭제/이동/문서화 절차를 안전하게 단계화한다.

## 전제

- 실제 앱 실행 진입점은 `package.json`의 `main` 및 `start` 기준으로 `api/index.js`이다.
- 런타임에서 직접 참조되는 주요 경로는 `api/`, `config/`, `src/`, `utils/`, `views/`, `public/`, `supabase-client.js`, `.env` 계열이다.
- `scripts/`는 웹 요청 처리 런타임과는 분리되어 있지만, Supabase/BGG 데이터 동기화 운영에 쓰일 수 있으므로 보존한다.
- `.agents/`, `.codex/`, `AGENTS.md`, `codex-pack/`은 앱 런타임이 아니라 Codex 하네스/작업 지침 관리 파일이다. 앱 기능에는 직접 영향이 없지만, 개발 워크플로우에는 영향이 있을 수 있다.
- 이 계획은 삭제를 수행하지 않는다. 삭제 전에는 각 단계의 검증 게이트를 통과해야 한다.

## 현재 구조 요약

```text
api/                  Express 앱 진입점
config/               환경 설정
src/                  컨트롤러, 라우트, 서비스, 미들웨어, 검증 로직
utils/                공용 유틸리티
views/                EJS 템플릿
public/               정적 CSS/JS/이미지
scripts/              Supabase/BGG 데이터 동기화 및 백필 스크립트
.agents/ .codex/      Codex repo-scoped skills/custom agents
codex-pack/           Codex 하네스 원본/동기화 패키지
```

## 삭제 후보 분류

### 1. 앱 동작 영향 없음, 정리 우선순위 높음

| 후보 | 근거 | 권장 조치 | 검증 |
| --- | --- | --- | --- |
| `node_modules/` | `.gitignore`에 포함된 로컬 의존성 설치물이며 소스가 아님 | 삭제 가능. 필요 시 `npm ci`로 복구 | `npm ci`, `npm start` 또는 서버 기동 확인 |
| `.env` | `.gitignore`에 포함된 로컬 비밀값 파일 | 저장소 정리 관점에서는 커밋 금지 유지. 삭제는 로컬 환경 복구 가능할 때만 | `.env.example`과 실제 필요한 키 비교 |
| `codex-pack/` | 루트 `.agents/`, `.codex/`, `AGENTS.md`를 생성/동기화하는 중복 패키지이며 앱 코드에서 참조되지 않음 | 제거 완료. 이후 재생성 방지를 위해 `.gitignore`에 추가 | `rg "codex-pack" . -g '!node_modules' -g '!.git'` 결과가 앱 코드에 없는지 확인 |
| `public/.gitkeep` | `public/`가 이미 실제 정적 파일을 포함하므로 디렉터리 보존용 파일이 필요 없음 | 제거 완료 | 정적 파일 참조 확인 |
| `src/models/README.md` | 실제 모델 코드 없이 향후 확장 placeholder만 포함 | 제거 완료 | `rg "src/models|models/README" . -g '!node_modules' -g '!.git'` |
| `public/images/scheduled-*.svg` | 템플릿, 클라이언트 JS, UI 시안에서 참조되지 않는 이전 정적 자산 | 제거 완료 | 파일명 참조 검색 |

### 2. 앱 동작 영향은 낮지만 개발 워크플로우 확인 필요

| 후보 | 근거 | 권장 조치 | 검증 |
| --- | --- | --- | --- |
| `.agents/` | 앱 런타임 참조 없음. Codex skill 제공용 | 로컬/생성 산출물로 취급하고 `.gitignore`에 추가 완료 | Codex 작업 방식에 영향 허용 여부 확인 |
| `.codex/` | 앱 런타임 참조 없음. custom agent 정의용 | 로컬/생성 산출물로 취급하고 `.gitignore`에 추가 완료 | Codex 작업 방식에 영향 허용 여부 확인 |
| `AGENTS.md` | 앱 런타임 참조 없음. Codex 작업 지침 | 하네스를 유지한다면 보존. 하네스를 제거한다면 함께 정리 | Codex 지침이 필요한지 확인 |
| `CLAUDE.md` | 앱 런타임 참조 없음. Claude용 개발 가이드 | 현재 팀에서 Claude 지침을 쓰지 않으면 삭제 후보. 내용 일부는 `README.md` 또는 `_workspace/`로 이관 가능 | `rg "CLAUDE" . -g '!node_modules'` 결과 확인 |

### 3. 삭제 금지 또는 보류

| 후보 | 보류 이유 |
| --- | --- |
| `public/images/*.svg` 중 bookmark/wishlist/planned/owned/icon 파일 | `views/index.ejs` 및 `public/js/toggles.js`에서 직접 참조 |
| `public/css/styles.css`, `public/js/*.js`, favicon 파일 | EJS 템플릿에서 직접 참조 |
| `public/icons/*.svg`, `public/ui-preview.html` | UI 시안용 파일로 확인됨. 삭제하지 않고 보존 |
| `sqlite/` | 현재 Supabase만 사용하는 것으로 확인됨. SQLite 크롤러/마이그레이션 도구 전체 제거 완료, 재추가 방지를 위해 `.gitignore`에 추가 |
| `scripts/*.js` | `package.json` scripts에서 직접 실행 가능 |
| `database_indexes.sql` | README에서 Supabase 인덱스 적용 파일로 안내됨 |

## 구조 개선 제안

### 1단계: 저장소 경계 정리

- `node_modules/`, `.env`는 소스 관리 대상이 아니므로 로컬 산출물로 명확히 둔다.
- `.agents/`, `.codex/`, `codex-pack/`은 로컬/생성 산출물로 취급하고 `.gitignore`에 추가했다.
- `codex-pack/`은 앱 런타임과 무관한 중복 패키지로 확인되어 제거했다.
- `AGENTS.md`는 현재 프로젝트 작업 지침으로 남긴다.

### 2단계: 운영 도구 정리

- `scripts/`는 Node 기반 운영 스크립트로 유지한다.
- `sqlite/`는 현재 Supabase만 사용하는 기준에서 제거했다.
- README/CLAUDE의 SQLite 관련 안내도 실제 구조에 맞게 제거했다.

### 3단계: 정적 리소스 정리

- `public/images/`는 현재 앱에서 쓰는 아이콘만 남기는 방향으로 정리한다.
- `public/icons/`, `public/ui-preview.html`는 UI 시안용으로 확인되어 보존한다.
- `public/.gitkeep`은 `public/`가 비어 있지 않아 제거했다.
- `public/images/scheduled-*.svg`는 참조되지 않는 이전 정적 자산으로 확인되어 제거했다.
- 삭제 전 브라우저에서 메인 페이지와 마이페이지의 이미지 404를 확인한다.

### 4단계: 문서 정리

- `README.md`의 프로젝트 구조가 실제 구조와 맞는지 갱신한다.
- `CLAUDE.md`, `AGENTS.md`, `codex-pack/README.md`의 역할이 중복되면 하나의 기준 문서만 남긴다.
- 개발자별 도구 문서는 앱 문서와 분리해 `_workspace/` 또는 별도 `docs/dev-tools.md`로 옮기는 방안을 검토한다.

## 단계별 실행 계획

### Phase 0. 기준선 확보

1. `git status --short`로 기존 사용자 변경을 기록한다.
2. `npm ci` 또는 현재 설치 상태에서 `npm start`가 가능한지 확인한다.
3. 앱 기동 후 `/`, `/users`, `/mypage`를 최소 확인한다.
4. `rg -n "삭제 후보 파일명"`으로 참조 여부를 기록한다.

### Phase 1. 무위험 로컬 산출물 정리

1. `node_modules/` 삭제 여부를 결정한다.
2. 삭제 후 `npm ci`로 복구 가능성을 확인한다.
3. `.env`는 삭제하지 않고, 커밋 제외 상태만 유지한다.

### Phase 2. Codex 하네스 중복 정리

1. `codex-pack/`은 제거 완료.
2. `.agents/`, `.codex/`, `codex-pack/`은 `.gitignore`에 추가 완료.
3. `AGENTS.md`는 프로젝트 작업 지침으로 보존한다.
4. 제거 후 앱 기동 및 `npm` scripts 목록 확인을 수행한다.

### Phase 3. 정적 리소스 검증 후 정리

1. `public/icons/`, `public/ui-preview.html`는 UI 시안용으로 보존한다.
2. `public/images/scheduled-*.svg`는 참조되지 않아 제거 완료.

### Phase 4. 데이터 도구 정리

1. `sqlite/`는 Supabase 전용 운영 기준으로 제거 완료.
2. `.gitignore`에 `sqlite/`를 추가해 재추적을 방지한다.
3. README/CLAUDE의 SQLite 관련 문서 항목을 제거 완료.

## 검증 게이트

각 삭제/이동 단계는 아래 조건을 통과해야 완료로 본다.

```bash
git status --short
npm ci
npm start
rg -n "삭제한_파일명|이동한_경로" . -g '!node_modules' -g '!.git'
```

추가로 브라우저에서 확인할 항목:

- `/` 메인 페이지 렌더링
- 검색/필터 UI 표시
- 즐겨찾기/위시리스트/플레이예정/보유 토글 아이콘 표시
- 리뷰 모달 열기/닫기
- `/users`, `/mypage` 페이지 렌더링
- 개발자 도구 Network 탭에서 정적 파일 404 없음

## 위험 및 완화

| 위험 | 영향 | 완화 |
| --- | --- | --- |
| Codex 하네스 파일 삭제로 작업 자동화 지침 손실 | 앱은 동작하지만 개발 워크플로우 저하 | 앱 정리와 하네스 정리를 별도 커밋/PR로 분리 |
| `sqlite/` 파일 삭제로 과거 SQLite 마이그레이션 경로 손실 | 과거 SQLite DB에서 재이관해야 할 때 별도 복구 필요 | 현재 Supabase만 사용한다는 운영 기준을 문서화하고, Supabase 동기화 스크립트는 보존 |
| 정적 SVG 삭제로 UI 아이콘 404 발생 | 사용자 화면 깨짐 | `rg` 참조 확인 후 브라우저 네트워크 검증 |
| `README.md`만 갱신하고 실제 구조와 불일치 | 온보딩 혼란 | 구조 변경과 문서 변경을 같은 커밋에서 검증 |

## 권장 첫 실행 범위

가장 안전한 첫 번째 정리 범위는 앱 런타임과 완전히 분리된 항목으로 제한한다.

1. `codex-pack/` 제거 완료
2. `.gitignore`에 `.agents/`, `.codex/`, `codex-pack/`, `sqlite/` 반영 완료
3. `public/ui-preview.html` 및 `public/icons/`는 UI 시안용으로 보존 결정
4. `sqlite/`는 Supabase 전용 운영 기준으로 제거 완료
5. `src/models/README.md`, `public/.gitkeep`, `public/images/scheduled-*.svg` 제거 완료

이 범위는 앱 코드 변경 없이 진행할 수 있고, 문제가 생겨도 원복 범위가 명확하다.
