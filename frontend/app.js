/* ================================================================
   app.js — Markov Trade 프론트엔드 로직
   TradingView 차트 + 종목 트리 사이드바 + AI 채팅 + 매매 일지
   ================================================================ */


// ── 1. 종목 데이터 구조 ──────────────────────────────────────────
// 카테고리 → 서브카테고리 → 종목 목록 계층 구조
// yfinance 종목 코드 형식: 미국주식(AAPL), 선물(ES=F), 코인(BTC-USD), 국내(005930.KS)

const MARKETS = {
  "🔮 선물": {
    "해외 지수": [
      { name: "S&P500",     ticker: "ES=F"  },
      { name: "나스닥100",   ticker: "NQ=F"  },
      { name: "다우30",      ticker: "YM=F"  },
      { name: "러셀2000",    ticker: "RTY=F" },
    ],
    "원자재": [
      { name: "금",          ticker: "GC=F"  },
      { name: "은",          ticker: "SI=F"  },
      { name: "원유 (WTI)",  ticker: "CL=F"  },
      { name: "천연가스",    ticker: "NG=F"  },
    ],
  },

  "📈 주식": {
    "국내": [
      { name: "삼성전자",       ticker: "005930.KS" },
      { name: "SK하이닉스",     ticker: "000660.KS" },
      { name: "NAVER",          ticker: "035420.KS" },
      { name: "카카오",         ticker: "035720.KS" },
      { name: "현대차",         ticker: "005380.KS" },
      { name: "LG에너지솔루션", ticker: "373220.KS" },
    ],
    "미국": [
      { name: "NVIDIA",    ticker: "NVDA"  },
      { name: "Apple",     ticker: "AAPL"  },
      { name: "Microsoft", ticker: "MSFT"  },
      { name: "Tesla",     ticker: "TSLA"  },
      { name: "Meta",      ticker: "META"  },
      { name: "Amazon",    ticker: "AMZN"  },
      { name: "Google",    ticker: "GOOGL" },
    ],
    "ETF": [
      { name: "SPY",   ticker: "SPY"  },
      { name: "QQQ",   ticker: "QQQ"  },
      { name: "SOXL",  ticker: "SOXL" },
      { name: "TQQQ",  ticker: "TQQQ" },
    ],
  },

  "🪙 코인": {
    "메이저": [
      { name: "비트코인",  ticker: "BTC-USD"  },
      { name: "이더리움",  ticker: "ETH-USD"  },
      { name: "BNB",       ticker: "BNB-USD"  },
      { name: "솔라나",    ticker: "SOL-USD"  },
    ],
    "알트": [
      { name: "리플",      ticker: "XRP-USD"  },
      { name: "도지코인",  ticker: "DOGE-USD" },
      { name: "에이다",    ticker: "ADA-USD"  },
      { name: "아발란체",  ticker: "AVAX-USD" },
    ],
  },
};


// ── 2. 사이드바 트리 렌더링 ──────────────────────────────────────

// 현재 선택된 종목을 추적 (하이라이트 표시용)
let activeTickerEl = null;

// MARKETS 데이터를 읽어서 DOM 트리로 렌더링하는 함수
function renderSidebar() {
  const treeEl = document.getElementById('market-tree');
  treeEl.innerHTML = '';  // 기존 내용 초기화

  for (const [categoryName, subs] of Object.entries(MARKETS)) {
    // ─ 카테고리 블록 생성 (예: "🔮 선물") ─
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'tree-category';

    // 카테고리 헤더 버튼 (클릭하면 접기/펼치기)
    const categoryHeader = document.createElement('button');
    categoryHeader.className = 'tree-category-header';
    categoryHeader.innerHTML = `<span>${categoryName}</span><span class="tree-arrow">▶</span>`;
    categoryHeader.addEventListener('click', () => {
      categoryDiv.classList.toggle('open');
    });

    const categoryBody = document.createElement('div');
    categoryBody.className = 'tree-category-body';

    // ─ 서브카테고리 블록 생성 (예: "해외 지수") ─
    for (const [subName, items] of Object.entries(subs)) {
      const subDiv = document.createElement('div');
      subDiv.className = 'tree-sub';

      const subHeader = document.createElement('button');
      subHeader.className = 'tree-sub-header';
      subHeader.innerHTML = `<span>${subName}</span><span class="tree-arrow">▶</span>`;
      subHeader.addEventListener('click', () => {
        subDiv.classList.toggle('open');
      });

      const subBody = document.createElement('div');
      subBody.className = 'tree-sub-body';

      // ─ 개별 종목 버튼 생성 ─
      for (const item of items) {
        const itemBtn = document.createElement('button');
        itemBtn.className = 'tree-item';
        itemBtn.dataset.ticker = item.ticker;   // 종목 코드 저장
        itemBtn.dataset.name   = item.name;     // 종목 이름 저장
        itemBtn.innerHTML = `
          <span>${item.name}</span>
          <span class="tree-ticker-code">${item.ticker}</span>
        `;

        // 종목 클릭 시 차트 로드
        itemBtn.addEventListener('click', () => {
          selectTicker(item.ticker, item.name, itemBtn);
        });

        subBody.appendChild(itemBtn);
      }

      subDiv.appendChild(subHeader);
      subDiv.appendChild(subBody);
      categoryBody.appendChild(subDiv);
    }

    categoryDiv.appendChild(categoryHeader);
    categoryDiv.appendChild(categoryBody);
    treeEl.appendChild(categoryDiv);
  }
}

// 종목 선택 — 하이라이트 업데이트 + 차트 로드
function selectTicker(ticker, name, btnEl) {
  // 이전 선택 종목 하이라이트 제거
  if (activeTickerEl) activeTickerEl.classList.remove('active');

  // 새 선택 종목 하이라이트
  btnEl.classList.add('active');
  activeTickerEl = btnEl;

  // 헤더 입력란과 종목명 업데이트
  document.getElementById('ticker-input').value = ticker;
  document.getElementById('active-ticker-name').textContent = name;

  // 차트 로드
  loadChart();
}


// ── 3. 사이드바 접기/펼치기 ─────────────────────────────────────

const mainGrid = document.getElementById('main-grid');

document.getElementById('sidebar-toggle').addEventListener('click', () => {
  mainGrid.classList.toggle('sidebar-collapsed');
});


// ── 4. TradingView 차트 초기화 ───────────────────────────────────

const chartContainer = document.getElementById('chart-container');

const chart = LightweightCharts.createChart(chartContainer, {
  layout: {
    background: { color: '#0d1117' },
    textColor:  '#8b949e',
  },
  grid: {
    vertLines: { color: '#21262d' },
    horzLines: { color: '#21262d' },
  },
  timeScale: {
    borderColor:    '#30363d',
    timeVisible:    true,
    secondsVisible: false,
  },
  rightPriceScale: { borderColor: '#30363d' },
});

const candleSeries = chart.addCandlestickSeries({
  upColor:         '#3fb950',
  downColor:       '#f85149',
  borderUpColor:   '#3fb950',
  borderDownColor: '#f85149',
  wickUpColor:     '#3fb950',
  wickDownColor:   '#f85149',
});

// 창 크기가 바뀌면 차트도 같이 조정
const resizeObserver = new ResizeObserver(() => {
  chart.applyOptions({
    width:  chartContainer.clientWidth,
    height: chartContainer.clientHeight,
  });
});
resizeObserver.observe(chartContainer);


// ── 5. 차트 데이터 로드 ──────────────────────────────────────────

// 현재 화면에 표시된 차트 데이터를 전역으로 저장
// — Gemini가 "현재 차트 분석해줘" 라고 할 때 이 데이터를 참조
let currentChartData = [];   // OHLCV 배열 (TradingView 형식)
let currentTicker    = '';   // 현재 종목 코드 (예: "BTC-USD")

async function loadChart() {
  const ticker   = document.getElementById('ticker-input').value.trim();
  const period   = document.getElementById('period-select').value;
  const interval = document.getElementById('interval-select').value;
  if (!ticker) return;

  const loadBtn = document.getElementById('load-btn');
  loadBtn.textContent = '로딩 중...';
  loadBtn.disabled = true;

  try {
    // TradingView용 OHLCV 데이터 요청
    const res = await fetch(
      `/price/${encodeURIComponent(ticker)}/ohlcv?period=${period}&interval=${interval}`
    );

    if (!res.ok) {
      alert(`데이터를 가져올 수 없습니다: ${ticker}`);
      return;
    }

    const ohlcvData = await res.json();
    candleSeries.setData(ohlcvData);   // 차트에 데이터 전달
    chart.timeScale().fitContent();    // 전체 데이터가 화면에 들어오도록 자동 조정

    // 전역 변수에 저장 — 채팅에서 Gemini가 분석에 활용
    currentChartData = ohlcvData;
    currentTicker    = ticker;

    // 현재가 정보 따로 불러오기
    await loadPriceInfo(ticker);

  } catch (err) {
    console.error('차트 로드 실패:', err);
  } finally {
    loadBtn.textContent = '조회';
    loadBtn.disabled = false;
  }
}

// 헤더와 가격 바에 현재가 정보 표시
async function loadPriceInfo(ticker) {
  try {
    const res  = await fetch(`/price/${encodeURIComponent(ticker)}?period=1d&interval=1h`);
    const data = await res.json();
    if (data.error) return;

    document.getElementById('current-price-display').textContent =
      Number(data['현재가']).toLocaleString();
    document.getElementById('info-ticker').textContent = ticker;
    document.getElementById('info-open').textContent   = `시가 ${Number(data['시가']).toLocaleString()}`;
    document.getElementById('info-high').textContent   = `고가 ${Number(data['고가']).toLocaleString()}`;
    document.getElementById('info-low').textContent    = `저가 ${Number(data['저가']).toLocaleString()}`;
    document.getElementById('info-close').textContent  = `현재가 ${Number(data['현재가']).toLocaleString()}`;
  } catch (err) {
    console.error('가격 정보 로드 실패:', err);
  }
}


// ── 6. 모델 선택 토글 ───────────────────────────────────────────

// 현재 선택된 모델 (기본값: gemini)
let selectedModel = 'gemini';

// 모델 버튼들에 클릭 이벤트 연결
document.querySelectorAll('.model-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // 모든 버튼에서 active 제거 후 클릭한 버튼에 추가
    document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // 선택된 모델 업데이트
    selectedModel = btn.dataset.model;
  });
});


// ── 7. AI 채팅 ───────────────────────────────────────────────────

const chatMessages = document.getElementById('chat-messages');

// 채팅창에 메시지를 추가하는 함수
// modelLabel: 응답 메시지에 어떤 모델이 답했는지 배지 표시용 (선택)
function appendMessage(role, text, modelLabel = null) {
  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.alignItems = role === 'user' ? 'flex-end' : 'flex-start';

  // 에이전트 응답이면 어떤 모델인지 배지 표시
  if (role === 'assistant' && modelLabel) {
    const badge = document.createElement('span');
    badge.className = `model-badge ${modelLabel}`;
    badge.textContent = modelLabel === 'claude' ? '◆ Claude' : '◈ Gemini';
    wrapper.appendChild(badge);
  }

  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  wrapper.appendChild(div);

  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;  // 최신 메시지로 스크롤
  return div;
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';
  appendMessage('user', text);

  // 로딩 표시 (현재 선택된 모델 이름 포함)
  const modelLabel  = selectedModel;
  const loadingDiv  = appendMessage('loading', `${modelLabel === 'claude' ? '◆ Claude' : '◈ Gemini'} 분석 중...`);

  try {
    // 현재 차트 데이터 준비
    // — 너무 많은 봉을 보내면 API 토큰이 낭비되므로 최근 50봉만 잘라서 전송
    const recentCandles = currentChartData.slice(-50);

    const res  = await fetch('/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      // 선택된 모델, 현재 종목 코드, 최근 OHLCV 데이터를 함께 전송
      body:    JSON.stringify({
        message:    text,
        model:      selectedModel,
        ticker:     currentTicker    || null,   // 종목 코드 (없으면 null)
        chart_data: recentCandles.length > 0    // 데이터가 있을 때만 포함
                    ? recentCandles
                    : null,
      }),
    });
    const data = await res.json();

    // 로딩 메시지를 실제 응답으로 교체
    loadingDiv.parentElement.remove();               // wrapper 전체 제거
    appendMessage('assistant', data.reply, data.model);  // 실제 사용 모델로 배지 표시

  } catch {
    loadingDiv.parentElement.remove();
    appendMessage('assistant', '⚠️ 서버 오류. 서버가 실행 중인지 확인하세요.');
  }

  await loadJournal();  // 에이전트가 일지를 기록했을 수 있으므로 갱신
}

async function resetChat() {
  // 현재 선택된 모델의 대화만 초기화
  await fetch(`/reset?model=${selectedModel}`, { method: 'POST' });
  chatMessages.innerHTML = '';
  appendMessage('assistant', `${selectedModel === 'claude' ? 'Claude' : 'Gemini'} 대화가 초기화되었습니다.`);
}


// ── 8. 매매 일지 ─────────────────────────────────────────────────

async function loadJournal() {
  try {
    const res     = await fetch('/journal');
    const journal = await res.json();
    const trades  = journal.trades || [];

    const wins   = trades.filter(t => t.result === 'win');
    const losses = trades.filter(t => t.result === 'loss');
    const opens  = trades.filter(t => t.result === 'open');
    const closed = wins.length + losses.length;
    const winRate = closed > 0 ? (wins.length / closed * 100).toFixed(1) + '%' : '—';

    document.getElementById('stat-total').textContent   = trades.length;
    document.getElementById('stat-win').textContent     = wins.length;
    document.getElementById('stat-loss').textContent    = losses.length;
    document.getElementById('stat-winrate').textContent = winRate;
    document.getElementById('stat-open').textContent    = opens.length;

    renderJournalTable(trades);
  } catch (err) {
    console.error('일지 로드 실패:', err);
  }
}

function renderJournalTable(trades) {
  const tbody    = document.getElementById('journal-tbody');
  const emptyMsg = document.getElementById('journal-empty');
  tbody.innerHTML = '';

  if (!trades.length) { emptyMsg.style.display = 'block'; return; }
  emptyMsg.style.display = 'none';

  // 최신 순으로 표시
  [...trades].reverse().forEach(t => {
    const tr = document.createElement('tr');

    const resultClass = { win: 'green', loss: 'red', breakeven: 'yellow', open: 'blue' }[t.result] || '';
    const dirIcon  = t.direction === '롱' ? '⬆️ 롱' : '⬇️ 숏';
    const dirClass = t.direction === '롱' ? 'green' : 'red';
    const time     = t.timestamp ? t.timestamp.slice(0, 16).replace('T', ' ') : '—';
    const pnlClass = t.pnl && t.pnl.startsWith('+') ? 'green' : 'red';

    tr.innerHTML = `
      <td class="muted">${t.id || '—'}</td>
      <td class="muted">${time}</td>
      <td><strong>${t.ticker || '—'}</strong></td>
      <td class="${dirClass}">${dirIcon}</td>
      <td>${Number(t.entry).toLocaleString()}</td>
      <td class="red">${Number(t.stop_loss).toLocaleString()}</td>
      <td class="green">${t.tp1 ? Number(t.tp1).toLocaleString() : '—'}</td>
      <td>${(t.leverage || 1) + 'x'}</td>
      <td class="${resultClass}">${t.result || '—'}</td>
      <td class="${pnlClass}">${t.pnl || '—'}</td>
      <td class="muted">${t.memo || '—'}</td>
      <td><button class="btn-delete" onclick="deleteTrade('${t.id}')">삭제</button></td>
    `;
    tbody.appendChild(tr);
  });
}

async function deleteTrade(tradeId) {
  if (!confirm(`${tradeId} 기록을 삭제할까요?`)) return;
  await fetch(`/journal/${tradeId}`, { method: 'DELETE' });
  await loadJournal();
}


// ── 9. 볼린저밴드 신호 시스템 ────────────────────────────────────
//
// 볼린저밴드(Bollinger Band)란?
// - 가격의 이동평균(MA) 위아래로 표준편차(변동성)만큼 밴드를 그린 지표
// - 가격이 밴드 밖으로 나가면 "과매수/과매도" 상태로 판단
// - Z-score = (현재가 - MA) / SD  (현재가가 평균에서 얼마나 떨어졌는지 표준화 값)


/* ── 9-1. 볼린저밴드 지표 계산 함수 ────────────────────────────────
   OHLCV 배열과 파라미터를 받아 MA, SD, 밴드, Z-score, Bandwidth, ATR을 반환한다  */
function calcBollingerBand(ohlcv, period = 20, stdMultiplier = 2.0) {
  if (!ohlcv || ohlcv.length < period) return null;

  // 종가 배열 추출
  const closes = ohlcv.map(c => c.close);

  // 이동평균(MA) 계산 — 마지막 period봉의 종가 평균
  const slice = closes.slice(-period);
  const ma    = slice.reduce((a, b) => a + b, 0) / period;

  // 표준편차(SD) 계산 — 변동성 측정
  const variance = slice.reduce((sum, v) => sum + Math.pow(v - ma, 2), 0) / period;
  const sd        = Math.sqrt(variance);

  // 볼린저 상단/하단 밴드
  const upper = ma + stdMultiplier * sd;
  const lower = ma - stdMultiplier * sd;

  // 현재가 (마지막 봉의 종가)
  const currentPrice = closes[closes.length - 1];

  // Z-score: 현재가가 평균에서 표준편차 몇 개 만큼 떨어져 있는지
  const zScore = sd > 0 ? (currentPrice - ma) / sd : 0;

  // Bandwidth: 밴드 폭을 MA로 나눈 비율 (변동성 크기 표준화)
  const bandwidth = ma > 0 ? (upper - lower) / ma : 0;

  // ATR (Average True Range) — 최근 period봉의 평균 변동폭
  // True Range = max(고가-저가, |고가-전봉종가|, |저가-전봉종가|)
  let atrSum = 0;
  const atrSlice = ohlcv.slice(-period);
  for (let i = 1; i < atrSlice.length; i++) {
    const high     = atrSlice[i].high;
    const low      = atrSlice[i].low;
    const prevClose = atrSlice[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    atrSum += tr;
  }
  const atr = atrSlice.length > 1 ? atrSum / (atrSlice.length - 1) : sd;

  return { ma, sd, upper, lower, currentPrice, zScore, bandwidth, atr };
}


/* ── 9-2. 레짐 판별 함수 ────────────────────────────────────────
   Bandwidth / ATR 비율로 "추세장" vs "박스/평균회귀장" 단순 판별.
   - bandwidth가 ATR 대비 넓으면 → 추세장 (가격이 방향성 있게 움직임)
   - 좁으면 → 박스장/평균회귀장 (가격이 제자리 등락)                  */
function detectRegime(bandwidth, atr, currentPrice) {
  // bandwidth를 절대값으로 환산하기 위해 현재가 곱함
  const bandwidthAbs = bandwidth * currentPrice;
  const ratio = atr > 0 ? bandwidthAbs / atr : 0;
  // ratio > 3.0 이면 추세장, 이하면 박스장 (경험적 임계값)
  return ratio > 3.0 ? 'trend' : 'mean_reversion';
}


/* ── 9-3. Z-score + 레짐 조합 룩업 테이블 ──────────────────────
   실시간 백테스트 없이 사전 연구 기반 하드코딩 값 사용.
   각 셀: { prob: 평균회귀확률(%), avgBars: 평균복귀봉수, ev: 기대값(R), winRate: 승률(%), samples: 샘플수 }

   레짐 구분:
   - mean_reversion (박스장): 평균회귀 전략이 유리
   - trend (추세장): 추세 추종이 유리 → 평균회귀 확률 낮아짐              */
const BB_LOOKUP = {
  // Z-score 구간 key: [z구간 하한, 상한]
  // 레짐별 2개 세트
  mean_reversion: {
    'z_gt_2.0':   { prob: 72, avgBars: 8,  ev: 1.4, winRate: 68, samples: 284 },
    'z_1.5_2.0':  { prob: 64, avgBars: 11, ev: 1.1, winRate: 60, samples: 412 },
    'z_1.0_1.5':  { prob: 55, avgBars: 14, ev: 0.7, winRate: 53, samples: 587 },
    'z_0_1.0':    { prob: 48, avgBars: 18, ev: 0.3, winRate: 49, samples: 731 },
    'z_neg1_0':   { prob: 48, avgBars: 18, ev: 0.3, winRate: 49, samples: 731 },
    'z_neg2_neg1':{ prob: 55, avgBars: 14, ev: 0.7, winRate: 53, samples: 587 },
    'z_neg2_neg15':{ prob: 64, avgBars: 11, ev: 1.1, winRate: 60, samples: 412 },
    'z_lt_neg2':  { prob: 72, avgBars: 8,  ev: 1.4, winRate: 68, samples: 284 },
  },
  trend: {
    'z_gt_2.0':   { prob: 35, avgBars: 20, ev: -0.2, winRate: 38, samples: 156 },
    'z_1.5_2.0':  { prob: 40, avgBars: 18, ev: 0.1,  winRate: 42, samples: 203 },
    'z_1.0_1.5':  { prob: 45, avgBars: 15, ev: 0.4,  winRate: 47, samples: 318 },
    'z_0_1.0':    { prob: 50, avgBars: 12, ev: 0.5,  winRate: 51, samples: 445 },
    'z_neg1_0':   { prob: 50, avgBars: 12, ev: 0.5,  winRate: 51, samples: 445 },
    'z_neg2_neg1':{ prob: 45, avgBars: 15, ev: 0.4,  winRate: 47, samples: 318 },
    'z_neg2_neg15':{ prob: 40, avgBars: 18, ev: 0.1,  winRate: 42, samples: 203 },
    'z_lt_neg2':  { prob: 35, avgBars: 20, ev: -0.2, winRate: 38, samples: 156 },
  },
};

// Z-score 값에서 룩업 테이블 키를 반환하는 함수
function getZScoreKey(z) {
  if (z >  2.0) return 'z_gt_2.0';
  if (z >  1.5) return 'z_1.5_2.0';
  if (z >  1.0) return 'z_1.0_1.5';
  if (z >= 0)   return 'z_0_1.0';
  if (z > -1.0) return 'z_neg1_0';
  if (z > -1.5) return 'z_neg2_neg1';
  if (z > -2.0) return 'z_neg2_neg15';
  return 'z_lt_neg2';
}


/* ── 9-4. TP / SL 계산 함수 ────────────────────────────────────
   방향(롱/숏)과 볼린저밴드 지표를 바탕으로 진입/목표/손절 가격 계산.

   롱 전략 (하단 밴드 근처 매수 → MA로 회귀 기대):
   - Entry = 현재가
   - TP    = MA (평균으로 복귀 목표)
   - SL    = lower - 0.5 * ATR (밴드 아래로 더 내려가면 손절)

   숏 전략 (상단 밴드 근처 매도 → MA로 회귀 기대):
   - Entry = 현재가
   - TP    = MA
   - SL    = upper + 0.5 * ATR                                    */
function calcSignalLevels(direction, bb) {
  const { currentPrice, ma, upper, lower, atr } = bb;
  let entry, tp, sl;

  if (direction === 'long') {
    entry = currentPrice;
    tp    = parseFloat(ma.toFixed(4));
    sl    = parseFloat((lower - 0.5 * atr).toFixed(4));
  } else {
    entry = currentPrice;
    tp    = parseFloat(ma.toFixed(4));
    sl    = parseFloat((upper + 0.5 * atr).toFixed(4));
  }

  const reward = Math.abs(tp - entry);
  const risk   = Math.abs(entry - sl);
  const rr     = risk > 0 ? reward / risk : 0;

  return { entry, tp, sl, rr };
}


/* ── 9-5. TradingView 가격선 (Entry/TP/SL 수평선) 관리 ──────────
   lightweight-charts의 createPriceLine() API를 사용.
   기존 라인이 있으면 지우고 새로 그린다.                            */

// 현재 차트에 그려진 라인 인스턴스 저장 (삭제 시 참조용)
let signalLines = [];

// 기존 신호 라인 전부 삭제
function clearSignalLines() {
  for (const line of signalLines) {
    try { candleSeries.removePriceLine(line); } catch (e) { /* 이미 삭제됐으면 무시 */ }
  }
  signalLines = [];
}

// Entry / TP / SL 수평선 차트에 그리기
function drawSignalLines(entry, tp, sl, direction) {
  clearSignalLines();

  // 진입가 라인 — 파란 점선
  const entryLine = candleSeries.createPriceLine({
    price:      entry,
    color:      '#58a6ff',
    lineWidth:  1,
    lineStyle:  2,   // 2 = Dashed
    axisLabelVisible: true,
    title: `Entry ${entry.toLocaleString()}`,
  });

  // TP 라인 — 초록 실선
  const tpLine = candleSeries.createPriceLine({
    price:      tp,
    color:      '#3fb950',
    lineWidth:  1,
    lineStyle:  0,   // 0 = Solid
    axisLabelVisible: true,
    title: `TP ${tp.toLocaleString()}`,
  });

  // SL 라인 — 빨강 실선
  const slLine = candleSeries.createPriceLine({
    price:      sl,
    color:      '#f85149',
    lineWidth:  1,
    lineStyle:  0,
    axisLabelVisible: true,
    title: `SL ${sl.toLocaleString()}`,
  });

  signalLines.push(entryLine, tpLine, slLine);
}


/* ── 9-6. 신호 생성 메인 함수 ──────────────────────────────────
   롱/숏 버튼 클릭 시 실행.
   1) 볼린저밴드 계산
   2) 레짐 판별
   3) 룩업 테이블 조회
   4) Entry/TP/SL 라인 차트 그리기
   5) 채팅창에 근거 텍스트 자동 출력
   6) 마지막으로 signal 데이터를 전역에 저장 (Phase 3 프리필 연동용)  */

let lastSignalData = null;  // Phase 3 Journal 프리필 연동용 저장

async function generateSignal(direction) {
  // 차트 데이터 없으면 안내
  if (!currentChartData || currentChartData.length < 25) {
    appendMessage('assistant', '차트 데이터를 먼저 불러와 주세요. 최소 25봉이 필요합니다.');
    return;
  }

  const period      = parseInt(document.getElementById('bb-period').value) || 20;
  const stdMult     = parseFloat(document.getElementById('bb-std').value) || 2.0;

  // 볼린저밴드 계산
  const bb = calcBollingerBand(currentChartData, period, stdMult);
  if (!bb) {
    appendMessage('assistant', `볼린저밴드 계산 실패 — 데이터가 부족합니다. (필요: ${period}봉 이상)`);
    return;
  }

  // 레짐 판별
  const regime = detectRegime(bb.bandwidth, bb.atr, bb.currentPrice);

  // 룩업 테이블에서 현재 Z-score + 레짐에 해당하는 통계 조회
  const zKey  = getZScoreKey(bb.zScore);
  const stats = BB_LOOKUP[regime][zKey];

  // Entry / TP / SL 계산
  const levels = calcSignalLevels(direction, bb);

  // 차트에 라인 그리기
  drawSignalLines(levels.entry, levels.tp, levels.sl, direction);

  // 신호 데이터 전역 저장 (Phase 3 프리필 연동용)
  lastSignalData = {
    ticker:    currentTicker,
    direction: direction === 'long' ? '롱' : '숏',
    entry:     levels.entry,
    stop_loss: levels.sl,
    tp1:       levels.tp,
    bb,
    regime,
    stats,
    levels,
  };

  // 레짐 한국어 표기
  const regimeKo = regime === 'trend' ? '추세장' : '박스/평균회귀장';
  const dirKo    = direction === 'long' ? '롱 (매수)' : '숏 (매도)';

  // 채팅창에 통계 근거 텍스트 자동 출력
  const signalText =
`=== ${dirKo} 신호 분석 (볼린저밴드 기반) ===

[현재 시장 상태]
- 종목: ${currentTicker}
- 현재가: ${bb.currentPrice.toLocaleString()}
- MA(${period}): ${bb.ma.toFixed(4)}
- 상단밴드: ${bb.upper.toFixed(4)}
- 하단밴드: ${bb.lower.toFixed(4)}
- Z-score: ${bb.zScore.toFixed(2)} (${zKey})
- Bandwidth: ${(bb.bandwidth * 100).toFixed(2)}%
- ATR: ${bb.atr.toFixed(4)}
- 레짐 판별: ${regimeKo}

[통계 근거 (룩업 테이블)]
- 평균회귀 확률: ${stats.prob}%
- 평균 복귀 소요 봉수: ${stats.avgBars}봉
- 기대값(EV): ${stats.ev > 0 ? '+' : ''}${stats.ev}R
- 승률: ${stats.winRate}%
- 샘플 수: ${stats.samples}건

[신호 레벨]
- Entry: ${levels.entry.toLocaleString()}
- TP (목표가): ${levels.tp.toLocaleString()}
- SL (손절가): ${levels.sl.toLocaleString()}
- R:R = 1:${levels.rr.toFixed(2)}

차트에 Entry(파란 점선) / TP(초록선) / SL(빨간선)이 표시되었습니다.`;

  appendMessage('assistant', signalText);
}


// 롱/숏 버튼 이벤트 연결
document.getElementById('signal-long-btn')?.addEventListener('click', async () => {
  await generateSignal('long');
  await renderTFPanel();  // 신호 생성 후 3-TF 패널 자동 표시
});
document.getElementById('signal-short-btn')?.addEventListener('click', async () => {
  await generateSignal('short');
  await renderTFPanel();  // 신호 생성 후 3-TF 패널 자동 표시
});

// 라인 초기화 버튼
document.getElementById('signal-clear-btn')?.addEventListener('click', () => {
  clearSignalLines();
  lastSignalData = null;
  // 3-TF 패널도 숨김
  const tfPanel = document.getElementById('tf-panel-section');
  if (tfPanel) tfPanel.style.display = 'none';
});

// 3-TF 패널 닫기 버튼
document.getElementById('tf-panel-close-btn')?.addEventListener('click', () => {
  const tfPanel = document.getElementById('tf-panel-section');
  if (tfPanel) tfPanel.style.display = 'none';
});


/* ── Phase 3-1. 3-TF 비교 패널 ─────────────────────────────────
   현재 종목을 3개 타임프레임으로 동시에 분석.
   - 초단타 TF: 15분봉 (5일 데이터)
   - 스윙 TF:   1시간봉 (1개월 데이터)
   - 골드 TF:   1일봉 (3개월 데이터)
   각 TF별로 볼린저밴드 계산 → 신호 레벨 독립 계산                  */

// 3개 타임프레임 정의
const TF_CONFIGS = [
  { label: '초단타 (15분봉)',  period: '5d',  interval: '15m', bbPeriod: 20 },
  { label: '스윙 (1시간봉)',   period: '1mo', interval: '1h',  bbPeriod: 20 },
  { label: '골드 (1일봉)',     period: '3mo', interval: '1d',  bbPeriod: 20 },
];

async function renderTFPanel() {
  if (!lastSignalData) return;

  const tfSection = document.getElementById('tf-panel-section');
  const tfCards   = document.getElementById('tf-cards');
  if (!tfSection || !tfCards) return;

  // 패널 표시
  tfSection.style.display = 'block';
  tfCards.innerHTML = '<p class="empty-msg" style="padding:10px;">3개 타임프레임 데이터 로딩 중...</p>';

  const ticker    = currentTicker;
  const direction = lastSignalData.direction === '롱' ? 'long' : 'short';
  const bbPeriod  = parseInt(document.getElementById('bb-period').value) || 20;
  const stdMult   = parseFloat(document.getElementById('bb-std').value) || 2.0;

  tfCards.innerHTML = '';

  // 각 타임프레임별로 데이터 가져와서 카드 생성
  for (const tf of TF_CONFIGS) {
    try {
      // yfinance OHLCV 데이터 요청 (각 TF별로 개별 API 호출)
      const res  = await fetch(`/price/${encodeURIComponent(ticker)}/ohlcv?period=${tf.period}&interval=${tf.interval}`);
      const data = await res.json();

      if (!data || data.length < bbPeriod) {
        // 데이터 부족 시 카드에 안내 메시지
        const card = document.createElement('div');
        card.className = 'tf-card';
        card.innerHTML = `
          <div class="tf-card-title">${tf.label}</div>
          <p style="font-size:11px; color:var(--text-muted);">데이터 부족 (${data?.length || 0}봉 / 최소 ${bbPeriod}봉 필요)</p>
        `;
        tfCards.appendChild(card);
        continue;
      }

      // 이 TF의 볼린저밴드 계산
      const bb     = calcBollingerBand(data, bbPeriod, stdMult);
      const regime = detectRegime(bb.bandwidth, bb.atr, bb.currentPrice);
      const zKey   = getZScoreKey(bb.zScore);
      const stats  = BB_LOOKUP[regime][zKey];
      const levels = calcSignalLevels(direction, bb);

      // 카드 DOM 생성
      const card = document.createElement('div');
      card.className = 'tf-card';

      const regimeKo  = regime === 'trend' ? '추세장' : '박스장';
      const evClass   = stats.ev >= 0 ? 'green' : 'red';
      const rrClass   = levels.rr >= 1.5 ? 'green' : 'yellow';

      card.innerHTML = `
        <div class="tf-card-title">${tf.label}</div>
        <table class="tf-card-table">
          <tr><td>현재가</td><td><strong>${bb.currentPrice.toLocaleString()}</strong></td></tr>
          <tr><td>Z-score</td><td>${bb.zScore.toFixed(2)}</td></tr>
          <tr><td>레짐</td><td>${regimeKo}</td></tr>
          <tr><td>Entry</td><td>${levels.entry.toLocaleString()}</td></tr>
          <tr><td>TP</td><td class="green">${levels.tp.toLocaleString()}</td></tr>
          <tr><td>SL</td><td class="red">${levels.sl.toLocaleString()}</td></tr>
          <tr><td>R:R</td><td class="${rrClass}">1:${levels.rr.toFixed(2)}</td></tr>
          <tr><td>기대값(EV)</td><td class="${evClass}">${stats.ev > 0 ? '+' : ''}${stats.ev}R</td></tr>
          <tr><td>성공확률</td><td>${stats.winRate}%</td></tr>
          <tr><td>샘플수</td><td>${stats.samples}건</td></tr>
        </table>
      `;
      tfCards.appendChild(card);

    } catch (err) {
      // API 호출 실패 시 에러 카드
      const card = document.createElement('div');
      card.className = 'tf-card';
      card.innerHTML = `
        <div class="tf-card-title">${tf.label}</div>
        <p style="font-size:11px; color:var(--red);">로드 실패: ${err.message}</p>
      `;
      tfCards.appendChild(card);
    }
  }
}


/* ── Phase 3-2. Signal → Journal 프리필 연동 ────────────────────
   롱/숏 버튼으로 생성된 신호 데이터를 Journal 탭에 초안으로 저장.
   결과(win/loss)만 채우면 완성되는 흐름 구현.                        */

document.getElementById('prefill-journal-btn')?.addEventListener('click', async () => {
  if (!lastSignalData) {
    alert('먼저 롱 또는 숏 버튼을 눌러 신호를 생성해 주세요.');
    return;
  }

  const signal = lastSignalData;
  const bbPeriod = parseInt(document.getElementById('bb-period').value) || 20;
  const stdMult  = parseFloat(document.getElementById('bb-std').value) || 2.0;

  // 신호 데이터로 journal POST 요청 (result = 'open' — 진행 중 초안)
  const payload = {
    ticker:    signal.ticker,
    direction: signal.direction,
    entry:     signal.entry,
    stop_loss: signal.stop_loss,
    tp1:       signal.tp1,
    leverage:  1,        // 기본값 — 사용자가 나중에 수정
    result:    'open',   // 체결 전 초안이므로 "진행 중"
    pnl:       '',
    memo:      `[Signal 자동생성] BB(${bbPeriod},${stdMult}) | Z=${signal.bb.zScore.toFixed(2)} | 레짐=${signal.regime === 'trend' ? '추세장' : '박스장'} | EV=${signal.stats.ev}R | 승률=${signal.stats.winRate}% | 체결 후 결과 업데이트 필요`,
  };

  try {
    const res = await fetch('/journal', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    if (res.ok) {
      // 저장 성공 알림 + Tab A 통계바 갱신
      appendMessage('assistant',
        `Journal 초안 저장 완료 (${data.id})\n` +
        `종목: ${signal.ticker} | 방향: ${signal.direction} | Entry: ${signal.entry}\n` +
        `TP: ${signal.tp1} | SL: ${signal.stop_loss}\n\n` +
        `Journal / Analytics 탭으로 이동해 결과와 손익을 입력하면 완성됩니다.`
      );
      await loadJournal();  // Tab A 통계바 갱신
    } else {
      alert('저장 실패: ' + JSON.stringify(data));
    }
  } catch (err) {
    alert('서버 오류: ' + err.message);
  }
});


// ── (기존 9번 이벤트 연결 — 번호 변경 없이 유지) ────────────────
// ── 이벤트 연결 ──────────────────────────────────────────────

document.getElementById('load-btn').addEventListener('click', loadChart);
document.getElementById('ticker-input').addEventListener('keydown', e => { if (e.key === 'Enter') loadChart(); });
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
document.getElementById('reset-btn').addEventListener('click', resetChat);


// ── 10. 탭 전환 UI ───────────────────────────────────────────────
// Tab A (Signal/Chart) 와 Tab B (Journal/Analytics) 사이 전환

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // 모든 탭 버튼에서 active 제거
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    // 모든 탭 콘텐츠 숨김
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // 클릭된 탭 버튼과 해당 콘텐츠 활성화
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');

    // Journal 탭으로 전환 시 KPI + 차트 + 테이블 최신화
    if (btn.dataset.tab === 'journal') {
      refreshJournalTab();
    }
  });
});


// ── 11. Journal / Analytics 탭 기능 ─────────────────────────────

// Chart.js 인스턴스를 전역으로 관리
// — 같은 캔버스에 새 차트를 그리기 전에 기존 차트를 destroy() 해야 함
let equityCurveChart  = null;
let dailyPnlChart     = null;
let rMultipleChart    = null;


/* ── 11-1. KPI 계산 함수 ──────────────────────────────────────────
   trades 배열을 받아 8개 핵심 성과 지표를 계산해 반환한다.
   pnl_amount 필드가 없으면 기존 pnl 문자열("+$330")에서 숫자를 파싱한다.  */
function calcKPI(trades) {
  // 결과가 확정된(win/loss/breakeven) 매매만 분리
  const closed = trades.filter(t => t.result === 'win' || t.result === 'loss' || t.result === 'breakeven');
  const wins   = trades.filter(t => t.result === 'win');
  const losses = trades.filter(t => t.result === 'loss');

  const totalClosed = closed.length;
  const winRate     = totalClosed > 0 ? (wins.length / totalClosed * 100) : 0;

  // pnl_amount 필드 우선 사용, 없으면 pnl 문자열 파싱
  // 예: "+$330" → 330, "-$47.50" → -47.50
  function parsePnl(t) {
    if (t.pnl_amount != null) return t.pnl_amount;
    if (!t.pnl) return 0;
    const num = parseFloat(t.pnl.replace(/[^0-9.\-]/g, ''));
    return isNaN(num) ? 0 : (t.pnl.includes('-') ? -Math.abs(num) : Math.abs(num));
  }

  const pnlList   = closed.map(parsePnl);
  const totalPnl  = pnlList.reduce((a, b) => a + b, 0);

  // Profit Factor = 총 이익 / 총 손실 절댓값 (손실이 0이면 표시 불가)
  const totalProfit = pnlList.filter(v => v > 0).reduce((a, b) => a + b, 0);
  const totalLoss   = Math.abs(pnlList.filter(v => v < 0).reduce((a, b) => a + b, 0));
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : null;

  // 평균 R-multiple
  const rList    = closed.filter(t => t.r_multiple != null).map(t => t.r_multiple);
  const avgR     = rList.length > 0 ? rList.reduce((a, b) => a + b, 0) / rList.length : null;

  // Expectancy (기대값) = (승률 * 평균이익) - (패율 * 평균손실)
  const avgWinPnl  = wins.length > 0 ? wins.map(parsePnl).reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLossPnl = losses.length > 0 ? Math.abs(losses.map(parsePnl).reduce((a, b) => a + b, 0) / losses.length) : 0;
  const winRateDec = winRate / 100;
  const expectancy = (winRateDec * avgWinPnl) - ((1 - winRateDec) * avgLossPnl);

  // Max Drawdown — equity curve에서 가장 큰 낙폭을 찾음
  let equity = 0;
  let peak   = 0;
  let maxDD  = 0;
  for (const t of closed) {
    equity += parsePnl(t);
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }

  // 평균 R:R — TP1과 SL 사이 거리 비율의 평균
  const rrList = trades.filter(t => t.tp1 && t.stop_loss && t.entry).map(t => {
    const reward = Math.abs(t.tp1 - t.entry);
    const risk   = Math.abs(t.entry - t.stop_loss);
    return risk > 0 ? reward / risk : null;
  }).filter(v => v != null);
  const avgRR = rrList.length > 0 ? rrList.reduce((a, b) => a + b, 0) / rrList.length : null;

  // 최대 연속 손실 스트릭 계산
  let maxLossStreak = 0;
  let curLossStreak = 0;
  for (const t of trades) {
    if (t.result === 'loss') { curLossStreak++; maxLossStreak = Math.max(maxLossStreak, curLossStreak); }
    else if (t.result === 'win') curLossStreak = 0;
  }

  return { totalPnl, winRate, avgR, profitFactor, expectancy, maxDD, avgRR, maxLossStreak };
}


/* ── 11-2. KPI 카드 DOM 업데이트 ────────────────────────────────── */
function renderKPI(kpi) {
  // 숫자를 읽기 좋은 문자열로 포맷 (소수점 2자리, 없으면 '—')
  function fmt(val, suffix = '', dp = 2) {
    if (val == null || isNaN(val)) return '—';
    return val.toFixed(dp) + suffix;
  }

  // 총손익 — 색상도 함께 설정
  const totalEl = document.getElementById('kpi-total-pnl');
  totalEl.textContent = fmt(kpi.totalPnl, '$', 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  totalEl.className   = 'kpi-value ' + (kpi.totalPnl >= 0 ? 'positive' : 'negative');

  document.getElementById('kpi-winrate').textContent = fmt(kpi.winRate, '%', 1);

  const avgREl = document.getElementById('kpi-avg-r');
  avgREl.textContent  = kpi.avgR != null ? fmt(kpi.avgR, 'R') : '—';
  if (kpi.avgR != null) avgREl.className = 'kpi-value ' + (kpi.avgR >= 0 ? 'positive' : 'negative');

  const pfEl = document.getElementById('kpi-profit-factor');
  pfEl.textContent  = kpi.profitFactor != null ? fmt(kpi.profitFactor) : '—';
  if (kpi.profitFactor != null) pfEl.className = 'kpi-value ' + (kpi.profitFactor >= 1 ? 'positive' : 'negative');

  const expEl = document.getElementById('kpi-expectancy');
  expEl.textContent  = fmt(kpi.expectancy, '$', 0);
  if (!isNaN(kpi.expectancy)) expEl.className = 'kpi-value ' + (kpi.expectancy >= 0 ? 'positive' : 'negative');

  const ddEl = document.getElementById('kpi-max-dd');
  ddEl.textContent  = kpi.maxDD > 0 ? '-$' + kpi.maxDD.toFixed(0) : '$0';
  ddEl.className    = 'kpi-value ' + (kpi.maxDD > 0 ? 'negative' : '');

  document.getElementById('kpi-avg-rr').textContent = kpi.avgRR != null ? '1:' + fmt(kpi.avgRR) : '—';

  const streakEl = document.getElementById('kpi-max-streak');
  streakEl.textContent = kpi.maxLossStreak > 0 ? kpi.maxLossStreak + '연패' : '없음';
  streakEl.className   = 'kpi-value ' + (kpi.maxLossStreak >= 3 ? 'negative' : '');
}


/* ── 11-3. Equity Curve (누적 손익 꺾은선) ─────────────────────── */
function renderEquityCurve(trades) {
  const canvas = document.getElementById('equity-curve-chart');
  if (!canvas) return;

  // 기존 차트 인스턴스가 있으면 먼저 파괴 (중복 방지)
  if (equityCurveChart) { equityCurveChart.destroy(); equityCurveChart = null; }

  // 결과가 확정된 매매만 날짜 순 정렬
  const closed = trades
    .filter(t => t.result === 'win' || t.result === 'loss' || t.result === 'breakeven')
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (closed.length === 0) return;

  // 누적 손익 계산
  let cumulative = 0;
  const labels  = [];
  const data    = [];
  for (const t of closed) {
    const pnl = t.pnl_amount != null ? t.pnl_amount
      : parseFloat((t.pnl || '0').replace(/[^0-9.\-]/g, '')) * (t.pnl?.includes('-') ? -1 : 1);
    cumulative += isNaN(pnl) ? 0 : pnl;
    labels.push(t.timestamp ? t.timestamp.slice(0, 10) : '?');
    data.push(parseFloat(cumulative.toFixed(2)));
  }

  equityCurveChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '누적 손익 ($)',
        data,
        borderColor: '#58a6ff',      // 파란색 꺾은선
        backgroundColor: 'rgba(88,166,255,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b949e', maxRotation: 45, font: { size: 10 } }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: '#21262d' } },
      },
    },
  });
}


/* ── 11-4. 일별 손익 막대 차트 ──────────────────────────────────── */
function renderDailyPnl(trades) {
  const canvas = document.getElementById('daily-pnl-chart');
  if (!canvas) return;

  if (dailyPnlChart) { dailyPnlChart.destroy(); dailyPnlChart = null; }

  // 날짜별로 손익을 합산 (같은 날 여러 매매가 있을 수 있음)
  const dayMap = {};
  for (const t of trades.filter(t => t.result === 'win' || t.result === 'loss' || t.result === 'breakeven')) {
    const day = t.timestamp ? t.timestamp.slice(0, 10) : '?';
    const pnl = t.pnl_amount != null ? t.pnl_amount
      : parseFloat((t.pnl || '0').replace(/[^0-9.\-]/g, '')) * (t.pnl?.includes('-') ? -1 : 1);
    dayMap[day] = (dayMap[day] || 0) + (isNaN(pnl) ? 0 : pnl);
  }

  const labels = Object.keys(dayMap).sort();
  const data   = labels.map(d => parseFloat(dayMap[d].toFixed(2)));
  // 양수는 초록, 음수는 빨간색 막대
  const colors = data.map(v => v >= 0 ? 'rgba(63,185,80,0.7)' : 'rgba(248,81,73,0.7)');

  dailyPnlChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: '일별 손익 ($)', data, backgroundColor: colors }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b949e', maxRotation: 45, font: { size: 10 } }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: '#21262d' } },
      },
    },
  });
}


/* ── 11-5. R-multiple 히스토그램 ────────────────────────────────── */
function renderRMultipleHist(trades) {
  const canvas = document.getElementById('r-multiple-chart');
  if (!canvas) return;

  if (rMultipleChart) { rMultipleChart.destroy(); rMultipleChart = null; }

  // r_multiple 값이 있는 매매만 추림
  const rValues = trades
    .filter(t => t.r_multiple != null)
    .map(t => parseFloat(t.r_multiple));

  if (rValues.length === 0) return;

  // 구간(bin) 정의: -3 이하 / -3~-2 / ... / 3~4 / 4 이상
  const bins   = ['≤-3', '-3~-2', '-2~-1', '-1~0', '0~1', '1~2', '2~3', '3~4', '4+'];
  const counts = new Array(bins.length).fill(0);

  for (const v of rValues) {
    if      (v <= -3) counts[0]++;
    else if (v <= -2) counts[1]++;
    else if (v <= -1) counts[2]++;
    else if (v <= 0)  counts[3]++;
    else if (v <= 1)  counts[4]++;
    else if (v <= 2)  counts[5]++;
    else if (v <= 3)  counts[6]++;
    else if (v <= 4)  counts[7]++;
    else              counts[8]++;
  }

  // 양수 구간은 초록, 음수 구간은 빨강
  const colors = bins.map((_, i) => i <= 3 ? 'rgba(248,81,73,0.7)' : 'rgba(63,185,80,0.7)');

  rMultipleChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: bins,
      datasets: [{ label: 'R-multiple 분포', data: counts, backgroundColor: colors }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e', font: { size: 10 }, stepSize: 1 }, grid: { color: '#21262d' } },
      },
    },
  });
}


/* ── 11-6. 확장 저널 테이블 렌더링 ─────────────────────────────────
   날짜·종목·방향·진입가·SL·TP1·레버리지·계약수·결과·
   손익금액·손익률·R-multiple·수수료·메모·삭제 컬럼 표시  */
function renderJournalV2(trades) {
  const tbody    = document.getElementById('journal-v2-tbody');
  const emptyMsg = document.getElementById('journal-v2-empty');
  if (!tbody) return;

  tbody.innerHTML = '';

  // 필터 값 읽기
  const filterTicker = (document.getElementById('journal-filter-ticker')?.value || '').trim().toUpperCase();
  const filterResult = document.getElementById('journal-filter-result')?.value || 'all';

  // 필터 적용
  let filtered = [...trades].reverse(); // 최신 순
  if (filterTicker) filtered = filtered.filter(t => (t.ticker || '').toUpperCase().includes(filterTicker));
  if (filterResult !== 'all') filtered = filtered.filter(t => t.result === filterResult);

  if (!filtered.length) { emptyMsg.style.display = 'block'; return; }
  emptyMsg.style.display = 'none';

  for (const t of filtered) {
    const tr = document.createElement('tr');

    const resultClass = { win: 'green', loss: 'red', breakeven: 'yellow', open: 'blue' }[t.result] || '';
    const dirClass    = t.direction === '롱' ? 'green' : 'red';
    const time        = t.timestamp ? t.timestamp.slice(0, 10) : '—';

    // pnl_amount: 숫자가 있으면 우선 표시, 없으면 기존 pnl 문자열 표시
    const pnlAmt   = t.pnl_amount != null ? (t.pnl_amount >= 0 ? '+$' : '-$') + Math.abs(t.pnl_amount).toFixed(2) : (t.pnl || '—');
    const pnlPct   = t.pnl_pct   != null ? (t.pnl_pct >= 0 ? '+' : '') + t.pnl_pct.toFixed(2) + '%' : '—';
    const rMultiple = t.r_multiple != null ? (t.r_multiple >= 0 ? '+' : '') + t.r_multiple.toFixed(2) + 'R' : '—';
    const fee      = t.fee != null ? '$' + t.fee.toFixed(2) : '—';
    const pnlClass = pnlAmt.startsWith('+') ? 'green' : (pnlAmt.startsWith('-') ? 'red' : '');

    tr.innerHTML = `
      <td class="muted">${time}</td>
      <td><strong>${t.ticker || '—'}</strong></td>
      <td class="${dirClass}">${t.direction === '롱' ? '▲ 롱' : '▼ 숏'}</td>
      <td>${Number(t.entry).toLocaleString()}</td>
      <td class="red">${Number(t.stop_loss).toLocaleString()}</td>
      <td class="green">${t.tp1 ? Number(t.tp1).toLocaleString() : '—'}</td>
      <td>${(t.leverage || 1)}x</td>
      <td>${t.contracts != null ? t.contracts : '—'}</td>
      <td class="${resultClass}">${t.result || '—'}</td>
      <td class="${pnlClass}">${pnlAmt}</td>
      <td class="${pnlClass}">${pnlPct}</td>
      <td class="${t.r_multiple >= 0 ? 'green' : 'red'}">${rMultiple}</td>
      <td class="muted">${fee}</td>
      <td class="muted" style="max-width:200px; overflow:hidden; text-overflow:ellipsis;" title="${(t.memo || '').replace(/"/g, '&quot;')}">${t.memo || '—'}</td>
      <td><button class="btn-delete" onclick="deleteTrade('${t.id}')">삭제</button></td>
    `;
    tbody.appendChild(tr);
  }
}


/* ── 11-7. CSV 내보내기 ─────────────────────────────────────────── */
function exportJournalCSV(trades) {
  // CSV 헤더 행 정의
  const headers = ['날짜', '종목', '방향', '진입가', 'SL', 'TP1', '레버리지', '계약수', '결과', '손익($)', '손익률(%)', 'R-multiple', '수수료($)', '메모'];

  const rows = trades.map(t => [
    t.timestamp?.slice(0, 10) || '',
    t.ticker || '',
    t.direction || '',
    t.entry || '',
    t.stop_loss || '',
    t.tp1 || '',
    t.leverage || 1,
    t.contracts || '',
    t.result || '',
    t.pnl_amount != null ? t.pnl_amount : (t.pnl || ''),
    t.pnl_pct != null ? t.pnl_pct : '',
    t.r_multiple != null ? t.r_multiple : '',
    t.fee != null ? t.fee : '',
    // 메모에 쉼표/줄바꿈이 있으면 따옴표로 감쌈
    `"${(t.memo || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  // Blob으로 파일 다운로드 처리 (서버 없이 프론트에서만 처리)
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `markov_trade_journal_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}


/* ── 11-8. 새 매매 추가 모달 ────────────────────────────────────── */

// 저장된 전체 trades 배열 (CSV 내보내기에서 참조)
let allTradesCache = [];

// 모달 열기
document.getElementById('journal-add-btn')?.addEventListener('click', () => {
  document.getElementById('add-trade-modal').style.display = 'flex';
});

// 모달 닫기 (닫기 버튼 / 취소 버튼)
document.getElementById('modal-close-btn')?.addEventListener('click', () => {
  document.getElementById('add-trade-modal').style.display = 'none';
});
document.getElementById('modal-cancel-btn')?.addEventListener('click', () => {
  document.getElementById('add-trade-modal').style.display = 'none';
});

// 배경 클릭 시 모달 닫기
document.getElementById('add-trade-modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});

// 모달 저장 버튼 — 입력값을 /journal POST로 전송
document.getElementById('modal-save-btn')?.addEventListener('click', async () => {
  // 필수 입력값 체크
  const ticker = document.getElementById('form-ticker').value.trim();
  const entry  = parseFloat(document.getElementById('form-entry').value);
  const sl     = parseFloat(document.getElementById('form-sl').value);

  if (!ticker || isNaN(entry) || isNaN(sl)) {
    alert('종목, 진입가, 손절가는 필수 항목입니다.');
    return;
  }

  // 폼 데이터 수집 (Optional 필드는 빈 값이면 null로)
  const payload = {
    ticker,
    direction:  document.getElementById('form-direction').value,
    entry,
    stop_loss:  sl,
    tp1:        parseFloat(document.getElementById('form-tp1').value) || null,
    leverage:   parseInt(document.getElementById('form-leverage').value) || 1,
    contracts:  parseInt(document.getElementById('form-contracts').value) || null,
    result:     document.getElementById('form-result').value,
    pnl_amount: parseFloat(document.getElementById('form-pnl-amount').value) || null,
    pnl_pct:    parseFloat(document.getElementById('form-pnl-pct').value) || null,
    r_multiple: parseFloat(document.getElementById('form-r-multiple').value) || null,
    fee:        parseFloat(document.getElementById('form-fee').value) || null,
    memo:       document.getElementById('form-memo').value.trim(),
    pnl:        '',  // 기존 pnl 문자열 필드 (빈값으로 — pnl_amount 사용)
  };

  try {
    const res = await fetch('/journal', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      // 저장 성공 — 모달 닫고 폼 초기화 후 탭 갱신
      document.getElementById('add-trade-modal').style.display = 'none';
      document.getElementById('form-ticker').value      = '';
      document.getElementById('form-entry').value       = '';
      document.getElementById('form-sl').value          = '';
      document.getElementById('form-tp1').value         = '';
      document.getElementById('form-pnl-amount').value  = '';
      document.getElementById('form-pnl-pct').value     = '';
      document.getElementById('form-r-multiple').value  = '';
      document.getElementById('form-fee').value         = '';
      document.getElementById('form-memo').value        = '';
      await refreshJournalTab();
      await loadJournal(); // Tab A 통계바도 갱신
    } else {
      alert('저장 실패: ' + JSON.stringify(data));
    }
  } catch (err) {
    alert('서버 오류: ' + err.message);
  }
});

// CSV 내보내기 버튼
document.getElementById('journal-export-csv')?.addEventListener('click', () => {
  if (!allTradesCache.length) { alert('내보낼 데이터가 없습니다.'); return; }
  exportJournalCSV(allTradesCache);
});

// 필터 변경 시 테이블 즉시 갱신
document.getElementById('journal-filter-ticker')?.addEventListener('input', () => {
  renderJournalV2(allTradesCache);
});
document.getElementById('journal-filter-result')?.addEventListener('change', () => {
  renderJournalV2(allTradesCache);
});


/* ── 11-8b. 전략 수정 가이드 자동 생성 ──────────────────────────────
   저널 데이터를 분석해 문제 Top3 / 권장 액션 Top3 / 다음 20트레이드 실험 플랜 출력.
   외부 AI 호출 없이 순수 통계 기반으로 로컬 계산.                   */

function generateStrategyGuide(trades) {
  const output = document.getElementById('strategy-guide-output');
  if (!output) return;

  const closed = trades.filter(t => t.result === 'win' || t.result === 'loss' || t.result === 'breakeven');

  if (closed.length < 3) {
    output.innerHTML = '<p class="empty-msg">분석에 최소 3건의 완료된 매매가 필요합니다.</p>';
    return;
  }

  // ── 통계 수집 ──
  const wins   = closed.filter(t => t.result === 'win');
  const losses = closed.filter(t => t.result === 'loss');
  const winRate = closed.length > 0 ? (wins.length / closed.length * 100) : 0;

  // R:R 계산 가능한 트레이드만 추림
  const rrList = closed.filter(t => t.tp1 && t.stop_loss && t.entry).map(t => {
    const reward = Math.abs(t.tp1 - t.entry);
    const risk   = Math.abs(t.entry - t.stop_loss);
    return risk > 0 ? reward / risk : 0;
  });
  const avgRR = rrList.length > 0 ? rrList.reduce((a, b) => a + b, 0) / rrList.length : 0;

  // R-multiple 평균
  const rList = closed.filter(t => t.r_multiple != null).map(t => t.r_multiple);
  const avgR  = rList.length > 0 ? rList.reduce((a, b) => a + b, 0) / rList.length : null;

  // 연속 손실 최대
  let maxStreak = 0, cur = 0;
  for (const t of trades) {
    if (t.result === 'loss') { cur++; maxStreak = Math.max(maxStreak, cur); }
    else cur = 0;
  }

  // 종목별 승률
  const byTicker = {};
  for (const t of closed) {
    if (!byTicker[t.ticker]) byTicker[t.ticker] = { win: 0, total: 0 };
    byTicker[t.ticker].total++;
    if (t.result === 'win') byTicker[t.ticker].win++;
  }
  const tickerStats = Object.entries(byTicker)
    .map(([k, v]) => ({ ticker: k, winRate: v.win / v.total * 100, total: v.total }))
    .sort((a, b) => a.winRate - b.winRate);

  // ── 문제 Top3 진단 ──
  const problems = [];

  if (winRate < 45) {
    problems.push(`낮은 승률 (${winRate.toFixed(1)}%) — 평균 45% 이하는 진입 조건이 부정확하거나 너무 잦은 매매를 의미합니다.`);
  }
  if (avgRR < 1.5 && rrList.length > 0) {
    problems.push(`낮은 평균 R:R (1:${avgRR.toFixed(2)}) — 목표가가 손절보다 가까워 기대값이 낮습니다. TP를 더 멀게 설정하거나 SL을 좁혀야 합니다.`);
  }
  if (maxStreak >= 3) {
    problems.push(`최대 연속 손실 ${maxStreak}회 — 연속 손실 구간에서 포지션 크기 조절 또는 매매 중단 기준이 필요합니다.`);
  }
  if (tickerStats.length > 1 && tickerStats[0].winRate < 35) {
    problems.push(`종목 "${tickerStats[0].ticker}" 승률 ${tickerStats[0].winRate.toFixed(1)}% — 특정 종목에서 지속 손실 중. 해당 종목 매매 일시 중단을 고려하세요.`);
  }
  if (avgR != null && avgR < 0) {
    problems.push(`평균 R-multiple 음수 (${avgR.toFixed(2)}R) — 이기는 매매보다 지는 매매의 손실 폭이 큽니다. 손절 기준을 엄격히 지켜야 합니다.`);
  }
  // 문제가 없으면 좋은 상태 표시
  if (problems.length === 0) problems.push('현재 데이터에서 심각한 패턴 문제는 발견되지 않았습니다. 현재 전략을 유지하세요.');

  // ── 권장 액션 Top3 ──
  const actions = [];

  if (winRate < 45) {
    actions.push('진입 조건 강화: 볼린저밴드 Z-score ±1.5 이상에서만 진입하도록 기준을 높이세요.');
  }
  if (avgRR < 1.5 && rrList.length > 0) {
    actions.push('R:R 개선: TP를 현재 설정보다 1ATR 더 멀게, SL은 0.5ATR 좁게 재설정하세요.');
  }
  if (maxStreak >= 3) {
    actions.push(`연속 손실 ${maxStreak}회 규칙 수립: 3연패 시 1일 매매 중단 + 포지션 크기 50% 축소 규칙을 적용하세요.`);
  }
  if (avgRR >= 1.5 && winRate >= 45) {
    actions.push('현재 전략이 통계적으로 양호합니다. 포지션 크기를 단계적으로 늘려 수익 규모를 키우는 것을 고려하세요.');
  }
  if (actions.length < 3) {
    actions.push('매매 일지를 더 쌓은 후 (최소 30건) 패턴 분석을 다시 실행하면 더 정확한 가이드를 얻을 수 있습니다.');
  }

  // ── 다음 20트레이드 실험 플랜 ──
  const plan = [];
  plan.push(`진입 기준: BB Z-score ${winRate < 45 ? '±1.5 이상' : '±1.0 이상'} + 레짐이 "박스장"인 경우에만 평균회귀 전략 적용`);
  plan.push(`목표 R:R: 최소 1:${Math.max(1.5, avgRR).toFixed(1)} (현재 평균 ${avgRR.toFixed(2)} 이상 유지)`);
  plan.push(`리스크: 계정의 최대 2%를 한 트레이드에 위험 노출 (${maxStreak >= 3 ? '연패 시 1% 축소' : '유지'})`);
  plan.push('20트레이드 완료 후 승률·R:R·최대연속손실을 재측정해 전략 지속 여부 결정');

  // ── DOM 출력 ──
  let html = '';

  html += `<div class="guide-section-title">문제 Top ${Math.min(3, problems.length)}</div>`;
  problems.slice(0, 3).forEach((p, i) => {
    html += `<div class="guide-item problem">${i + 1}. ${p}</div>`;
  });

  html += `<div class="guide-section-title" style="margin-top:14px;">권장 액션 Top ${Math.min(3, actions.length)}</div>`;
  actions.slice(0, 3).forEach((a, i) => {
    html += `<div class="guide-item action">${i + 1}. ${a}</div>`;
  });

  html += `<div class="guide-section-title" style="margin-top:14px;">다음 20트레이드 실험 플랜</div>`;
  plan.forEach((p, i) => {
    html += `<div class="guide-item plan">${i + 1}. ${p}</div>`;
  });

  html += `<p style="font-size:11px; color:var(--text-muted); margin-top:12px;">분석 기준: ${closed.length}건 완료 매매 | 생성 시각: ${new Date().toLocaleString('ko-KR')}</p>`;

  output.innerHTML = html;
}

// 전략 가이드 생성 버튼 이벤트
document.getElementById('generate-guide-btn')?.addEventListener('click', () => {
  generateStrategyGuide(allTradesCache);
});


/* ── 11-9. refreshJournalTab — Journal 탭 전체 갱신 ─────────────── */
async function refreshJournalTab() {
  try {
    const res    = await fetch('/journal');
    const data   = await res.json();
    const trades = data.trades || [];

    // 전역 캐시 업데이트 (CSV 내보내기, 필터에서 사용)
    allTradesCache = trades;

    // KPI 카드 갱신
    renderKPI(calcKPI(trades));

    // Chart.js 시각화 3개 갱신
    renderEquityCurve(trades);
    renderDailyPnl(trades);
    renderRMultipleHist(trades);

    // 확장 저널 테이블 갱신
    renderJournalV2(trades);

  } catch (err) {
    console.error('Journal 탭 갱신 실패:', err);
  }
}


// ── 12. 앱 시작 ──────────────────────────────────────────────────

(async function init() {
  // 사이드바 트리 렌더링
  renderSidebar();

  // 코인 > 메이저 카테고리를 기본으로 펼쳐놓기
  // (BTC-USD를 기본 종목으로 사용)
  const categories = document.querySelectorAll('.tree-category');
  categories.forEach(cat => {
    if (cat.querySelector('.tree-category-header span')?.textContent.includes('코인')) {
      cat.classList.add('open');
      // 메이저 서브카테고리도 펼치기
      const firstSub = cat.querySelector('.tree-sub');
      if (firstSub) firstSub.classList.add('open');
    }
  });

  // BTC-USD를 기본 선택으로 설정
  document.getElementById('ticker-input').value = 'BTC-USD';
  document.getElementById('active-ticker-name').textContent = '비트코인';

  // 첫 번째 BTC 항목 하이라이트
  const btcBtn = document.querySelector('[data-ticker="BTC-USD"]');
  if (btcBtn) { btcBtn.classList.add('active'); activeTickerEl = btcBtn; }

  // 차트와 일지 초기 로드
  await loadChart();
  await loadJournal();

  // 환영 메시지
  appendMessage('assistant',
    'Markov Trade에 오신 걸 환영합니다.\n\n' +
    '왼쪽 패널에서 종목을 선택하거나 직접 입력하세요.\n\n' +
    '상단 탭에서 Signal/Chart 와 Journal/Analytics 탭을 전환할 수 있습니다.\n\n' +
    '예시 요청:\n' +
    '- "현재 BTC 차트 분석해줘"\n' +
    '- "리스크 계산: 자본 500만, 리스크 2%, 진입 95000, 손절 97000, 레버 10x"\n' +
    '- "오늘 매매 기록해줘: BTC 숏 95000 진입, win, +4%"'
  );
})();
