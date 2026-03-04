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

## PDCA #6 — RSI 서브차트 + BB_LOOKUP_RSI 2D 통계 + Entry Filter + Exit Advice

**날짜:** 2026-03-03

### ✅ Plan
- 목표: RSI를 Signal 시스템에 완전 통합 (서브차트 시각화 + 통계 2D 룩업 + 진입 필터 + 청산 조언)
- 수정 파일: `frontend/index.html`, `frontend/style.css`, `frontend/app.js`
- 핵심 고려사항:
  - Tab A의 journal-section(간단 통계바 + 저널 테이블) 제거 — Tab B로 기능 통합 완료
  - lightweight-charts RSI 서브차트는 별도 인스턴스로 100px 고정 높이
  - BB_LOOKUP_RSI는 기존 BB_LOOKUP 위에 Z-score × RSI 2D 확장
  - detectRegime() 2분류 → calcRegimeScore() 3분류(추세/전환/박스)로 교체
  - 기존 BB_LOOKUP + detectRegime()는 legacy 호환 유지

### ✅ Do
- `frontend/index.html`
  - `<section class="journal-section">` 전체 블록 제거 (stat-total~journal-empty 포함)
  - `<div id="rsi-container">` 추가 (chart-container 다음, price-info-bar 이전)
- `frontend/style.css`
  - `.journal-section`, `.stats-bar`, `.stat-card`, `.journal-table-wrap`, `.journal-table` 제거
  - `.tf-levels-box`, `.tf-level-row`, `.tf-level-label`, `.tf-level-value` 추가 (Entry/TP/SL 시각 구분)
  - `.tf-level-entry` (파란 왼쪽 테두리), `.tf-level-tp` (초록), `.tf-level-sl` (빨강) 추가
  - `#rsi-container { height: 100px; margin-top: 2px; border-top: 1px solid var(--border); }` 추가
- `frontend/app.js`
  - `calcRSI(closes, period)` — Wilder RSI 공식 (SMA 초기값 후 지수평활)
  - `getRSIBucket(rsi)` + `getRSIBucketLabel(bucket)` — 5구간 분류
  - `BB_LOOKUP_RSI` — mean_reversion × trend 각 8개 Z-score 구간 × 5개 RSI 구간 = 80셀
  - `getZScoreKeyForRSI(z)` — BB_LOOKUP_RSI용 별도 키 매핑 (기존 getZScoreKey와 키 이름 다름)
  - `calcRegimeScore(bb, rsiValue)` — ADX Proxy + EMA 방향 + RSI 편향 가중합 → 3분류
  - `checkEntryFilter(direction, zScore, rsiValue, regimeType)` — Z/RSI/Regime 3조건 체크
  - `detectSimpleDivergence(direction, rsiHistory)` — 최근 5봉 RSI 방향 반전 감지
  - `calcExitAdvice(direction, rsiValue, rsiHistory)` — 부분청산/TP확장/다이버전스 조언
  - `getConfidenceLabel(samples)` — 샘플 수 기반 신뢰도 4단계
  - `generateSignal()` 수정 — RSI 계산 통합 + BB_LOOKUP_RSI 조회 + 진입필터 + Exit 조언 채팅 출력
  - `renderTFPanel()` 수정 — 각 TF별 RSI 계산 + `.tf-levels-box` 구조로 Entry/TP/SL 표시
  - `loadChart()` 수정 — RSI 서브차트 렌더링 (보라 라인 + 70/30 점선 기준선)
    - `window.rsiChart`, `window.rsiSeries`, `window.rsi70Series`, `window.rsi30Series` 전역 관리
    - ResizeObserver에 RSI 컨테이너 너비 동기화 추가
  - `loadJournal()` 수정 — stat-* DOM 업데이트 제거, allTradesCache 갱신만 유지
  - `renderJournalTable()` 수정 — `if (!tbody) return` null 가드 추가

### 🔲 Check
- [ ] RSI 서브차트가 메인 캔들 차트 아래에 보라색 라인으로 표시
- [ ] RSI 70/30 점선 기준선 표시
- [ ] 롱/숏 버튼 클릭 시 채팅창에 "RSI 통계 엔진 + Entry Filter 체크 + Exit 보조 로직" 섹션 출력
- [ ] Entry Filter 3조건 PASS/FAIL 상태 정확히 표시
- [ ] 3-TF 패널 카드에 Entry/TP/SL이 색상 구분 박스로 표시
- [ ] Tab A에 journal-section(통계바+저널 테이블)이 사라짐 확인
- [ ] 앱 시작 시 콘솔 에러 없음 확인

### 🔲 Act
> Check 완료 후 작성 예정


---

## PDCA #7 — Monte Carlo 리스크 검증 + 반응형 레이아웃 + 추가 기능 6가지

**날짜:** 2026-03-03

### ✅ Plan
- 목표: 요청 1~3 구현 (Monte Carlo 리스크 시뮬레이션 / 반응형 레이아웃 / 6가지 추가 기능)
- 수정 파일: `main.py`, `frontend/index.html`, `frontend/style.css`, `frontend/app.js`
- 핵심 고려사항:
  - 기존 Claude/Gemini 채팅, TradingView 차트, 볼린저밴드 신호 동작 완전 유지
  - Monte Carlo: numpy 없이 Python 표준 random + statistics 모듈만 사용
  - 반응형: minmax() CSS 함수로 최솟값 보장, 미디어 쿼리 3개 (1200/900/650px)
  - 인라인 수정: click-to-edit 패턴, blur/Enter 저장, Escape 취소

### ✅ Do

#### TASK 1: 반응형 레이아웃 수정
- `style.css` — `.main-grid` grid-template-columns에 `minmax(300px, 1fr)` + `minmax(260px, 360px)` 적용
- `style.css` — `#chart-container` min-height/min-width 300px 보장
- `style.css` — `.chart-section`, `.chat-section` min-width:0 추가 (그리드 수축 허용)
- `style.css` — 미디어 쿼리 3개 추가 (1200px, 900px, 650px 중단점)
  - 900px 이하: 채팅 패널 하단으로 이동 (grid-row: 2)
  - 650px 이하: 사이드바 숨김, 세로 단일 컬럼
- `app.js` — ResizeObserver에서 `Math.max(clientWidth, 300)` 최솟값 보장

#### TASK 2: 재조회 시 엔트리/포지션 초기화
- `app.js` — `loadChart()` 시작 부분에 `clearSignalLines()`, `lastSignalData=null`, 3-TF 패널 숨김, Risk Sim 섹션 숨김, entry-override 초기화 추가

#### TASK 3: 엔트리 값 직접 입력
- `index.html` — `.bb-control-bar` 내 롱/숏 버튼 옆에 `id="entry-override"` input 추가
- `app.js` — `generateSignal()` 내 `entry-override` 값 읽어 `levels.entry` 덮어씀 + R:R 재계산
- `app.js` — 신호 생성 후 입력창에 사용된 entry 값 표시

#### TASK 4: Tab B 전략 가이드 우측 이동
- `index.html` — `#tab-journal` 내부를 `.journal-layout-grid` 래퍼로 2컬럼 분리
  - 좌: `.journal-main-col` (KPI + 차트 + 저널 테이블)
  - 우: `.journal-guide-col` (전략 수정 가이드)
- `style.css` — `.journal-layout-grid` `grid-template-columns: 1fr 320px`
- `style.css` — `.journal-guide-col` sticky top, max-height 설정
- `style.css` — 900px 이하 세로 스택 복귀 미디어 쿼리

#### TASK 5: 저널 인라인 수정
- `style.css` — `.editable-cell`, `.editable-cell input/select` 스타일 추가
- `app.js` — `renderJournalV2()` 완전 재작성
  - `makeEditableCell()` 헬퍼 함수: 더블클릭 → input/select 전환 → blur/Enter 저장 → PUT API
  - 수정 가능 컬럼: entry/stop_loss/tp1/leverage/contracts/result/pnl_amount/pnl_pct/r_multiple/fee/memo
  - 날짜/방향은 읽기 전용 유지

#### TASK 6: 3-TF 패널 아이콘형 Entry/TP/SL
- `style.css` — `.tf-icon-bar`, `.tf-icon-item`, `.tf-icon-label`, `.tf-icon-value` 추가
  - entry-icon (파랑), tp-icon (초록), sl-icon (빨강) 배경 테마
- `app.js` — `renderTFPanel()` 내 `.tf-levels-box` → `.tf-icon-bar` 구조로 교체
  - 아이콘 배너가 카드 상단(제목 바로 아래), 통계 테이블이 그 아래

#### TASK 7: RSI 차트 x축 동기화
- `app.js` — `loadChart()` 내 RSI 차트 초기화 후 양방향 subscribeVisibleTimeRangeChange 이벤트 구독
  - `isSyncing` 플래그로 무한 루프 방지
  - 초기 범위도 `getVisibleRange()` → `setVisibleRange()` 동기화

#### TASK 8: Monte Carlo 리스크 시뮬레이션
- `main.py` — `import random, statistics` 추가
- `main.py` — `SimulateRequest` Pydantic 모델 추가 (win_rate/avg_win_R/avg_loss_R/n_trades/leverage/runs/cache_key)
- `main.py` — `_sim_cache: dict = {}` 서버 메모리 캐시 추가
- `main.py` — `POST /simulate` 엔드포인트 추가
  - Permutation 방식 1,000회 시뮬레이션
  - 파산 기준: 누적 -50R 이하
  - 반환: mean_final_R/median_final_R/worst_5pct_final_R/mean_max_dd_pct/worst_95pct_dd_pct/risk_of_ruin_pct/longest_loss_streak_95pct
- `index.html` — `.chat-section` 내 모델 토글 아래에 `#risk-sim-section` DOM 추가 (기본 숨김)
- `style.css` — `.risk-sim-section`, `.risk-sim-kpi-row`, `.risk-sim-kpi`, `.risk-badge` 스타일 추가
- `app.js` — `generateSignal()` 마지막에 `runMonteCarloSim()` 자동 호출 추가
  - EV에서 avg_win_R 역산 (avgLoss=1R 고정)
  - cache_key = `${ticker}_${rsiZKey}_${rsiBucket}_${regimeType}`
- `app.js` — `runMonteCarloSim(params)` 함수 추가 (app.js 12번 섹션 앞)
  - KPI 카드 4개 렌더링 (Worst 5% DD / Ruin % / Sample N / 신뢰도)
  - 경고 조건: Ruin > 10%, Worst DD > 30%, N < 100

### 🔲 Check
- [ ] 브라우저 창 폭 줄여도 차트 + 채팅 패널 유지 확인
- [ ] 900px 이하에서 채팅 패널 하단 이동 확인
- [ ] 종목 재조회 시 기존 라인 + entry input 초기화 확인
- [ ] entry-override input에 값 입력 후 롱/숏 버튼 클릭 → 해당 값으로 라인 그려짐 확인
- [ ] Tab B Journal/Analytics 탭에서 좌: 일지 목록, 우: 전략 가이드 레이아웃 확인
- [ ] 저널 테이블 셀 더블클릭 → input 전환 → Enter 저장 확인
- [ ] 3-TF 패널 각 카드 상단에 Entry/TP/SL 아이콘 배너 표시 확인
- [ ] RSI 차트 스크롤/줌 시 메인 차트와 x축 동기화 확인
- [ ] 롱/숏 버튼 클릭 후 Risk Simulation 섹션 자동 표시 확인
- [ ] KPI 카드 4개 값 표시 + 경고 배지 색상 확인

### 🔲 Act
> Check 완료 후 작성 예정


---

## PDCA #8 — UI 개선 7가지 (TP 정리 / 패널 토글 / Risk Sim 이동 / 디자인 / 배율 / 접기 / 기본값)

**날짜:** 2026-03-04

### Plan
- 목표: 가독성 개선 + LG Gram 배율 대응 + 기본값 변경 (7가지 사용자 요청)
- 수정 파일: `frontend/index.html`, `frontend/style.css`, `frontend/app.js`
- 핵심 고려사항:
  - 기존 signalLines 배열, runMonteCarloSim() 함수 로직 변경 없이 DOM 이동만으로 처리
  - chat-body-wrap 래핑으로 기존 이벤트 바인딩(model-btn, send-btn 등) 영향 없음
  - clamp() 변수로 배율 환경에 자동 대응

### Do

#### TASK 1: TP 라인 가독성 개선
- `app.js` `renderTFPanel()` — `.tf-icon-bar`에서 tp-icon div 제거
- `app.js` — 통계 테이블에 `TP (목표가)` 행 추가 (각 TF별 1개로 명확히 표시)

#### TASK 2: 3-TF 패널 접기/펼치기 토글 버튼
- `index.html` — `tf-panel-close-btn` → `tf-body-toggle-btn`으로 교체
- `app.js` — 토글 이벤트: tf-cards + risk-sim-section 동시 숨김/표시
- `app.js` — `data-has-data` 속성으로 Risk Sim이 데이터 없을 때 펼쳐도 표시 안 함

#### TASK 3: Risk Simulation + RSI 엔진을 3-TF 패널로 이동
- `index.html` — `#risk-sim-section` DOM을 `.chat-section`에서 `#tf-panel-section`(tf-cards 위)로 이동

#### TASK 4: 3-TF 아이콘 디자인 개선
- `style.css` — linear-gradient + box-shadow inset으로 깊이감 추가
- `style.css` — `.tf-card-title` 배지 스타일로 개선

#### TASK 5: LG Gram 저해상도 화면 배율 문제 해결
- `index.html` — viewport-fit=cover 추가
- `style.css` — --sidebar-width: clamp(160px, 13vw, 220px)
- `style.css` — --font-base: clamp(12px, 0.85vw, 14px)
- `style.css` — DPR 1.25 / 1.5 미디어 쿼리 추가

#### TASK 6: AI 분석 창 접기 버튼 추가
- `index.html` — chat-collapse-btn 추가, chat-body-wrap으로 래핑
- `style.css` — chat-collapsed 상태 CSS
- `app.js` — 클릭 이벤트 + 250ms 후 차트 리사이즈

#### TASK 7: 기본 조회 옵션 변경 + 타임프레임 추가
- `index.html` — 기본값 5d/1h, 1분/3분/5분봉 옵션 추가

### Check
- [ ] 3-TF 패널 카드 TP 아이콘 사라짐 + 테이블에 TP 행 표시 확인
- [ ] "▼ 접기" / "▶ 펼치기" 토글 동작 확인
- [ ] 롱/숏 버튼 클릭 후 Risk Sim이 3-TF 패널 내부에 표시 확인
- [ ] LG Gram 고배율에서 레이아웃 확인
- [ ] AI 채팅 접기/펼치기 동작 + 차트 리사이즈 확인
- [ ] 기본 조회 5일/1시간봉 + 1분/3분/5분봉 옵션 확인

### Act
> Check 완료 후 작성 예정
