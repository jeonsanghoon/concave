# concave

15×15 웹 오목 게임 — Vercel 배포 지원

## 기능

- **사람 vs 사람** — 같은 기기에서 번갈아 두기
- **사람 vs 컴퓨터** — AI와 대결
- **온라인 대전** — 방 코드로 원격 1:1 대전

## Vercel 배포

### 1. GitHub에 푸시 후 Vercel 연결

```bash
npm install
vercel
```

또는 [vercel.com](https://vercel.com)에서 GitHub 저장소 Import

### 2. Upstash Redis 연동 (온라인 대전 필수)

Vercel 대시보드에서:

1. 프로젝트 → **Storage** → **Create Database**
2. **Upstash Redis** 선택 → 무료 플랜 생성
3. 프로젝트에 연결하면 환경변수가 자동 설정됩니다
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

> 로컬 `vercel dev` 는 Redis 없이도 메모리 fallback으로 테스트 가능합니다.
> 프로덕션 배포에서는 Redis 연동이 필요합니다.

### 3. 재배포

환경변수 추가 후 **Redeploy** 하면 온라인 대전이 동작합니다.

## 로컬 실행

```bash
npm install

# 정적 파일만 (온라인 API 없음)
python3 -m http.server 8080

# Vercel dev (API 포함)
npx vercel dev
```

## 온라인 대전 사용법

1. **방 만들기** — 6자리 코드 생성 → 친구에게 공유
2. **방 참가** — 받은 코드 입력
3. 방장 = 흑(선공), 참가자 = 백

## 규칙

- 15×15 보드
- 흑 선공
- 가로·세로·대각선 5목 승리
