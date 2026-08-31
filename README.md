# concave

15×15 웹 오목 게임 — Vercel 배포

**배포 URL:** https://concave-five.vercel.app

## 기능

| 기능 | 설명 | Vercel |
|------|------|--------|
| 사람 vs 사람 | 같은 기기 로컬 대전 | ✅ |
| 사람 vs AI | AI 대결 | ✅ |
| 로그인/회원가입 | 계정 생성 및 로그인 | Redis 필요 |
| 온라인 대전 | 원격 1:1 대전 | Redis 필요 |
| 방 목록 | 대기 중인 방 목록 | Redis 필요 |
| 닉네임 | 플레이어 이름 표시 | ✅ |

## Vercel 배포 (필수 설정)

### 1. GitHub 연동 (완료)

저장소: https://github.com/jeonsanghoon/concave

push 시 Vercel 자동 배포

### 2. Upstash Redis 연결 (온라인/로그인 필수)

1. [Vercel 대시보드](https://vercel.com) → 프로젝트 선택
2. **Storage** → **Create Database** → **Upstash Redis**
3. 프로젝트에 **Connect** → **Redeploy**

자동 설정되는 환경변수:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### 3. AUTH_SECRET 설정 (권장)

Settings → Environment Variables:

```
AUTH_SECRET=랜덤문자열32자이상
```

### 4. 배포 확인

```
https://concave-five.vercel.app/api/health
```

`ok: true` 이면 모든 기능 사용 가능

## 로컬 개발

```bash
npm install
npm run dev   # http://localhost:3000 (API 포함)
```

로컬은 Redis 없이 메모리 fallback으로 테스트 가능

## 사용법

1. **회원가입/로그인** (온라인 대전 필수)
2. **온라인 대전** → 방 목록에서 참가 또는 방 만들기
3. 방장 = 흑(선공), 참가자 = 백

## 규칙

- 15×15 보드, 흑 선공, 5목 승리
