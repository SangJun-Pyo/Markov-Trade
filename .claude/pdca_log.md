# 📋 PDCA 작업 로그 — 차트 기획자 앱

> 작업할 때마다 아래 형식으로 기록
> 에이전트들이 작업 후 자동으로 여기에 추가

---

## PDCA #1 — 기초 앱 구조 구축

**날짜:** 2026-03-03

### ✅ Plan
- 목표: FastAPI + HTML/JS 기반 개인용 트레이딩 분석 앱 구축
- 수정 파일: 전체 신규 생성
- 핵심 고려사항: 기존 agent.py, tools.py 재사용 / npm 없이 CDN으로 TradingView 연동

### ✅ Do
- `tools.py` — 4개 Tool 핸들러 + `get_ohlcv_for_chart()` 추가
- `main.py` — FastAPI 서버 + 8개 엔드포인트
- `frontend/index.html` — 3분할 레이아웃 (차트/채팅/일지)
- `frontend/style.css` — 다크 트레이딩 테마
- `frontend/app.js` — TradingView 캔들 차트 + 채팅 + 일지 CRUD

### 🔲 Check
- [ ] 서버 실행 확인
- [ ] BTC-USD 차트 로드 확인
- [ ] AI 채팅 응답 확인
- [ ] 매매 기록 저장/삭제 확인

### 🔲 Act
> Check 완료 후 작성 예정

---

## PDCA #2 — 앱 이름 변경 + 종목 멀티셀렉션 사이드바

**날짜:** 2026-03-03

### ✅ Plan
- 목표: 앱 이름 → Markov Trade / 종목 선택 사이드바 (선물/주식/코인 계층 구조)
- 수정 파일: `frontend/index.html`, `frontend/style.css`, `frontend/app.js`
- 핵심 고려사항: Python 코드 수정 없음 / 사이드바 접기 기능 / BTC-USD 기본 선택

### ✅ Do
- `index.html` — 타이틀 "Markov Trade" / `<aside class="market-sidebar">` 추가 / ☰ 토글 버튼
- `style.css` — 3컬럼 그리드 (사이드바|차트|채팅) / 트리 스타일 / `.sidebar-collapsed` 클래스
- `app.js` — `MARKETS` 데이터 구조 (선물 2개/주식 3개/코인 2개 서브카테고리) / `renderSidebar()` / 접기 토글

**종목 구성:**
| 카테고리 | 서브 | 종목 수 |
|----------|------|---------|
| 🔮 선물 | 해외 지수, 원자재 | 4 + 4 |
| 📈 주식 | 국내, 미국, ETF | 6 + 7 + 4 |
| 🪙 코인 | 메이저, 알트 | 4 + 4 |

### 🔲 Check
- [ ] 사이드바 트리 펼치기/접기 작동
- [ ] 종목 클릭 시 차트 자동 로드
- [ ] ☰ 버튼으로 사이드바 접기/펼치기
- [ ] 선택된 종목 하이라이트 (파란 테두리)
- [ ] 국내 주식 (.KS), 선물 (=F), 코인 (-USD) 차트 로드 확인

### 🔲 Act
> Check 완료 후 작성 예정

---

## PDCA #3 — (다음 작업)

**날짜:** —

### 🔲 Plan
>

### 🔲 Do
>

### 🔲 Check
- [ ]

### 🔲 Act
>
