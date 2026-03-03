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

## PDCA #3 — Gemini 모델 추가 + Model Switch Toggle UI

**날짜:** 2026-03-03

### ✅ Plan
- 목표: Gemini 1.5 Flash 모델을 추가하고 UI에서 Claude / Gemini를 전환할 수 있는 토글 구현
- 신규 파일: `llm.py` (Gemini 에이전트)
- 수정 파일: `main.py`, `frontend/index.html`, `frontend/style.css`, `frontend/app.js`, `.env.example`
- 핵심 고려사항:
  - Gemini는 Tool Use 미지원 → 텍스트 분석 전용으로 설계
  - API 키 없어도 서버가 죽지 않게 `None` 반환 팩토리 패턴 사용
  - 두 모델 모두 같은 시스템 프롬프트로 응답 형식 통일

### ✅ Do
- `llm.py` 신규 생성
  - `SYSTEM_PROMPT` — Claude·Gemini 공통 트레이딩 분석 프롬프트
  - `GeminiAgent` 클래스 — `gemini-1.5-flash`, 채팅 세션 히스토리 유지, `chat()` / `reset()`
  - `create_gemini_agent()` — API 키/패키지 없으면 `None` 반환 (서버 보호)
- `main.py` 수정
  - `ChatRequest`에 `model: str = "gemini"` 필드 추가
  - `/chat` 엔드포인트 — `model` 값으로 Claude / Gemini 분기
  - `/reset?model=` — 특정 모델 또는 전체 초기화 지원
- `frontend/index.html` — 채팅 섹션에 모델 토글 바 추가 (기본: Gemini 활성)
- `frontend/style.css` — `.model-toggle-bar`, `.model-btn`, `.model-dot`, `.model-badge` 스타일
  - Claude 점 = 보라 (`#bc8cff`), Gemini 점 = 파랑 (`#4285f4`)
- `frontend/app.js` — `selectedModel` 변수 / 토글 클릭 핸들러 / 응답 배지 (`◆ Claude` / `◈ Gemini`)
- `.env.example` — `GEMINI_API_KEY` 항목 추가
- GitHub 커밋·푸시 완료 (commit `b7e2c79`)

### 🔲 Check
- [ ] Gemini 토글 클릭 시 버튼 활성 상태 전환 확인
- [ ] Gemini 채팅 응답 수신 및 `◈ Gemini` 배지 표시 확인
- [ ] Claude 토글로 전환 후 Tool Use (가격 조회, 리스크 계산) 정상 작동 확인
- [ ] `/reset?model=gemini` 호출 시 Gemini 대화만 초기화 확인
- [ ] GEMINI_API_KEY 없을 때 안내 메시지 출력 확인

### 🔲 Act
> Check 완료 후 작성 예정

---

## PDCA #4 — Gemini 실제 차트 데이터 기반 분석

**날짜:** 2026-03-03

### ✅ Plan
- 목표: Gemini가 "현재 차트 분석해줘" 요청 시 가정값이 아닌 화면의 실제 OHLCV 데이터로 분석
- 수정 파일: `frontend/app.js`, `main.py` (llm.py 수정 없음)
- 핵심 고려사항:
  - chart_data 없는 경우 예외 처리 (null → 원본 메시지 그대로)
  - 최근 50봉만 잘라 전송 (토큰 낭비 방지)
  - Claude 분기는 기존 Tool Use 흐름 그대로 유지 (건드리지 않음)
  - ChatRequest 신규 필드는 Optional로 하위 호환성 유지

### ✅ Do
- `frontend/app.js`
  - `currentChartData`, `currentTicker` 전역 변수 선언
  - `loadChart()` 내 `candleSeries.setData()` 직후 두 변수에 저장
  - `sendMessage()` — fetch body에 `ticker`, `chart_data`(최근 50봉) 추가
- `main.py`
  - `from typing import Any` import 추가
  - `ChatRequest` — `ticker: str | None = None`, `chart_data: list[Any] | None = None` 필드 추가
  - Gemini 분기: `req.chart_data`가 있으면 OHLCV를 텍스트로 변환해 메시지 앞에 컨텍스트 헤더로 붙여 전달
    - 형식: `[현재 차트 데이터 — {ticker}, 최근 N봉]\n{OHLCV 텍스트}\n\n위 실제 데이터를 바탕으로 답하세요:\n{원본 메시지}`
  - 데이터 없으면 원본 메시지 그대로 전달 (기존 동작 유지)

### 🔲 Check
- [ ] BTC-USD 차트 로드 후 "현재 차트 분석해줘" → Gemini가 실제 가격 수치로 분석
- [ ] chart_data 없는 상태에서 메시지 전송 시 정상 동작 확인
- [ ] Claude 모델 전환 후 Tool Use 흐름 변화 없음 확인

### 🔲 Act
> Check 완료 후 작성 예정

---

## PDCA #5 — 대형 기능 추가: 볼린저밴드 신호 + Journal Analytics + 3-TF + 전략 가이드

**날짜:** 2026-03-03

### ✅ Plan
- 목표: 4가지 대형 기능(A/B/C/D)을 3개 Phase로 나눠 순차 구현
- 수정 파일: `frontend/index.html`, `frontend/style.css`, `frontend/app.js`, `main.py`
- 핵심 고려사항:
  - 기존 Claude/Gemini 채팅, TradingView 차트, 기존 저널 CRUD 동작 유지
  - `trading_journal.json` 하위 호환성 (신규 필드 모두 Optional)
  - 볼린저밴드 룩업 테이블은 하드코딩 (실시간 백테스트 없음)
  - Chart.js CDN 활용 (npm 설치 불필요)

### ✅ Do

#### Phase 1 — 탭 UI + Journal 스키마 확장 + KPI + Equity Curve
- `index.html`
  - `<nav class="tab-nav">` 추가 (Tab A: Signal/Chart, Tab B: Journal/Analytics)
  - Tab B 구조: KPI 8개 카드 + Analytics 차트 3개(canvas) + 확장 저널 테이블 + 새 매매 추가 모달
  - `<head>`에 Chart.js 4.4.0 CDN 추가
- `style.css`
  - `.tab-nav`, `.tab-btn`, `.tab-content` 탭 스타일
  - `.kpi-section`, `.kpi-card`, `.kpi-value` KPI 카드 스타일
  - `.analytics-charts`, `.analytics-chart-box` Chart.js 캔버스 영역
  - `.journal-advanced`, `.journal-table-v2`, `.journal-toolbar` 확장 테이블
  - `.modal-overlay`, `.modal-box`, `.form-grid` 추가 모달
- `main.py`
  - `TradeLog` — contracts/fee/pnl_amount/pnl_pct/r_multiple 필드 추가
  - `PUT /journal/{trade_id}` 엔드포인트 신규 추가
- `app.js`
  - 탭 전환 핸들러 (`.tab-btn` 클릭 → `.tab-content.active` 교체)
  - `calcKPI(trades)` — 총손익/승률/평균R/PF/Expectancy/MaxDD/평균RR/최대연속손실
  - `renderKPI(kpi)` — KPI 카드 DOM 업데이트
  - `renderEquityCurve(trades)` — Chart.js 꺾은선 차트
  - `renderDailyPnl(trades)` — Chart.js 막대 차트
  - `renderRMultipleHist(trades)` — Chart.js 히스토그램
  - `renderJournalV2(trades)` — 확장 테이블 (15컬럼) + 필터
  - `exportJournalCSV(trades)` — Blob CSV 다운로드
  - `refreshJournalTab()` — 위 모든 함수를 한번에 갱신
  - 새 매매 추가 모달 CRUD 연동

#### Phase 2 — 볼린저밴드 신호 + 롱/숏 버튼 + 차트 라인 + 채팅 근거 출력
- `index.html`
  - 차트 섹션 위에 `.bb-control-bar` 추가 (BB기간/표준편차 입력 + 롱/숏/초기화 버튼)
- `style.css`
  - `.bb-control-bar`, `.bb-param-input`, `.btn-signal`, `.btn-long`, `.btn-short` 스타일
- `app.js`
  - `calcBollingerBand(ohlcv, period, stdMultiplier)` — MA/SD/Upper/Lower/Z-score/Bandwidth/ATR 계산
  - `detectRegime(bandwidth, atr, currentPrice)` — 추세장 vs 박스장 판별
  - `BB_LOOKUP` — Z-score 8구간 × 레짐 2개 = 16셀 하드코딩 룩업 테이블
  - `getZScoreKey(z)` — Z-score 값 → 룩업 키 변환
  - `calcSignalLevels(direction, bb)` — Entry/TP/SL/R:R 계산
  - `clearSignalLines()` / `drawSignalLines(entry, tp, sl)` — TradingView `createPriceLine()` API
  - `generateSignal(direction)` — 위 함수 통합 + 채팅창 통계 텍스트 자동 출력
  - 전역 `lastSignalData` — Phase 3 프리필 연동용 저장

#### Phase 3 — 3-TF 비교 + 전략 가이드 + Signal→Journal 프리필
- `index.html`
  - Tab A 하단에 `.tf-panel-section` (3-TF 비교 카드 + 프리필 버튼) 추가
  - Tab B에 `.strategy-guide-section` (분석 생성 버튼 + 출력 영역) 추가
- `style.css`
  - `.tf-panel-section`, `.tf-cards`, `.tf-card`, `.tf-card-table` 3-TF 카드 스타일
  - `.strategy-guide-section`, `.guide-item`, `.guide-section-title` 가이드 스타일
- `app.js`
  - `TF_CONFIGS` — 초단타(15m/5d) / 스윙(1h/1mo) / 골드(1d/3mo) 3개 TF 정의
  - `renderTFPanel()` — 3개 TF 각각 `/price/ohlcv` API 호출 → BB 계산 → 카드 렌더링
  - `generateStrategyGuide(trades)` — 저널 통계 분석 → 문제 Top3 / 권장액션 Top3 / 20트레이드 플랜 DOM 출력
  - 프리필 버튼 — `lastSignalData`로 `/journal POST` → 초안 저장 + 채팅창 알림

### 🔲 Check
- [ ] 탭 전환 (Signal↔Journal) 정상 동작
- [ ] KPI 카드 8개 숫자 표시 정상
- [ ] Equity Curve / 일별손익 / R-multiple 차트 렌더링
- [ ] 확장 저널 테이블 15컬럼 표시 + 필터 동작
- [ ] CSV 내보내기 파일 다운로드
- [ ] 새 매매 추가 모달 저장 동작
- [ ] BB 파라미터 변경 후 롱/숏 버튼 클릭 → 채팅창 통계 출력
- [ ] TradingView 차트에 Entry(파란)/TP(초록)/SL(빨간) 라인 표시
- [ ] 3-TF 패널 3개 카드 표시 (데이터 로드 성공)
- [ ] Journal 프리필 버튼 → open 상태 초안 저장
- [ ] 전략 가이드 생성 버튼 → 문제/액션/플랜 출력
- [ ] 기존 Claude/Gemini 채팅 + 기존 저널 삭제 정상 동작 유지

### 🔲 Act
> Check 완료 후 작성 예정


---

## PDCA #6 — (다음 작업)

**날짜:** —

### 🔲 Plan
>

### 🔲 Do
>

### 🔲 Check
- [ ]

### 🔲 Act
>
