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

// RSI 서브차트 전역 변수 — loadChart() 호출마다 재사용/갱신
window.rsiChart   = null;
window.rsiSeries  = null;
window.rsi70Series = null;
window.rsi30Series = null;

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

// 창 크기가 바뀌면 메인 차트도 같이 조정
// Math.max()로 최솟값(300px)을 보장해 화면이 너무 좁아져도 차트가 0이 되지 않음
const resizeObserver = new ResizeObserver(() => {
  // clientWidth/Height가 0이면 최솟값 300 사용
  const w = Math.max(chartContainer.clientWidth,  300);
  const h = Math.max(chartContainer.clientHeight, 300);
  chart.applyOptions({ width: w, height: h });

  // RSI 서브차트도 너비 동기화 (높이는 100px 고정)
  if (window.rsiChart) {
    const rsiEl = document.getElementById('rsi-container');
    const rsiW  = Math.max(rsiEl ? rsiEl.clientWidth : w, 300);
    window.rsiChart.applyOptions({ width: rsiW });
  }
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

  // ── 재조회 시 기존 신호 라인 + 입력값 초기화 ───────────────────────
  // 종목이나 타임프레임이 바뀌면 이전 신호가 새 데이터에 맞지 않으므로 리셋
  clearSignalLines();
  lastSignalData = null;

  // 엔트리 직접입력 값 초기화 (새 종목에서는 다시 자동 계산 사용)
  const entryOverrideEl = document.getElementById('entry-override');
  if (entryOverrideEl) entryOverrideEl.value = '';

  // 3-TF 비교 패널도 숨김 (이전 종목 데이터가 남아있으면 혼동 유발)
  const tfPanel = document.getElementById('tf-panel-section');
  if (tfPanel) tfPanel.style.display = 'none';

  // Monte Carlo Risk Simulation 섹션도 숨김
  const riskSimSection = document.getElementById('risk-sim-section');
  if (riskSimSection) riskSimSection.style.display = 'none';

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

    // ── RSI 서브차트 렌더링 ─────────────────────────────────────
    // 종가 배열 추출 후 Wilder RSI(14) 계산
    const closes    = ohlcvData.map(c => c.close);
    const rsiResult = calcRSI(closes, 14);
    window.rsiHistory = rsiResult.rsiValues;

    // RSI 값에 타임스탬프를 붙여 lightweight-charts 형식으로 변환
    // RSI는 (period+1)번째 봉부터 계산되므로 앞 14개 봉은 건너뜀
    const rsiOffset   = closes.length - rsiResult.rsiValues.length;
    const rsiChartData = rsiResult.rsiValues.map((v, i) => ({
      time:  ohlcvData[rsiOffset + i].time,
      value: v,
    }));

    // 70 기준선 데이터 (과매수 경계선)
    const rsi70Data = rsiChartData.map(d => ({ time: d.time, value: 70 }));
    // 30 기준선 데이터 (과매도 경계선)
    const rsi30Data = rsiChartData.map(d => ({ time: d.time, value: 30 }));

    const rsiContainer = document.getElementById('rsi-container');

    // 기존 RSI 차트 인스턴스가 있으면 제거 후 재생성
    // — 종목/기간 변경 시 컨테이너를 재사용해야 하므로 DOM 초기화 필요
    if (window.rsiChart) {
      try { window.rsiChart.remove(); } catch (e) { /* 이미 제거됐으면 무시 */ }
      window.rsiChart   = null;
      window.rsiSeries  = null;
      window.rsi70Series = null;
      window.rsi30Series = null;
    }

    // 새 RSI 차트 인스턴스 생성 — 메인 차트와 동일한 다크 테마
    window.rsiChart = LightweightCharts.createChart(rsiContainer, {
      layout:   { background: { color: '#0d1117' }, textColor: '#8b949e' },
      grid:     { vertLines: { color: '#21262d' }, horzLines: { color: '#21262d' } },
      timeScale: { borderColor: '#30363d', timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#30363d', scaleMargins: { top: 0.1, bottom: 0.1 } },
      height: 100,
      width:  rsiContainer.clientWidth,
    });

    // RSI 메인 라인 — 보라색으로 메인 캔들과 구분
    window.rsiSeries = window.rsiChart.addLineSeries({
      color:      '#bc8cff',  // 보라색 — Claude/Anthropic 브랜드 색상 재활용
      lineWidth:  1,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    window.rsiSeries.setData(rsiChartData);

    // RSI 70 기준선 — 과매수 경계 (얇은 빨간 점선)
    window.rsi70Series = window.rsiChart.addLineSeries({
      color:      'rgba(248, 81, 73, 0.5)',
      lineWidth:  1,
      lineStyle:  2,   // 점선
      priceLineVisible: false,
      lastValueVisible: false,
    });
    window.rsi70Series.setData(rsi70Data);

    // RSI 30 기준선 — 과매도 경계 (얇은 초록 점선)
    window.rsi30Series = window.rsiChart.addLineSeries({
      color:      'rgba(63, 185, 80, 0.5)',
      lineWidth:  1,
      lineStyle:  2,   // 점선
      priceLineVisible: false,
      lastValueVisible: false,
    });
    window.rsi30Series.setData(rsi30Data);

    // ── 메인 차트 ↔ RSI 차트 양방향 x축 동기화 ─────────────────────
    // 한쪽에서 스크롤/줌 시 다른 쪽도 같은 범위로 자동 업데이트
    // isSyncing 플래그로 서로가 서로를 계속 호출하는 무한 루프 방지
    let isSyncing = false;

    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      // RSI 차트가 없거나 이미 동기화 중이면 건너뜀
      if (isSyncing || !window.rsiChart || !range) return;
      isSyncing = true;
      window.rsiChart.timeScale().setVisibleRange(range);
      isSyncing = false;
    });

    window.rsiChart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      // 메인 차트에서 동기화 중이면 건너뜀 (루프 방지)
      if (isSyncing || !range) return;
      isSyncing = true;
      chart.timeScale().setVisibleRange(range);
      isSyncing = false;
    });

    // 초기 범위 동기화 — 차트 첫 로드 시 RSI가 메인 차트와 같은 범위 표시
    const initialRange = chart.timeScale().getVisibleRange();
    if (initialRange && window.rsiChart) {
      window.rsiChart.timeScale().setVisibleRange(initialRange);
    }

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
  // Tab A의 journal-section이 제거되었으므로 stat-* DOM 업데이트는 생략.
  // Tab B의 refreshJournalTab()이 KPI + 차트 + 테이블을 전담한다.
  // 이 함수는 에이전트가 일지를 기록한 후 Tab B 데이터를 최신화하는 용도로만 유지.
  try {
    const res     = await fetch('/journal');
    const journal = await res.json();
    // allTradesCache 갱신 — CSV 내보내기 / 필터에서 참조
    allTradesCache = journal.trades || [];
  } catch (err) {
    console.error('일지 로드 실패:', err);
  }
}

function renderJournalTable(trades) {
  // Tab A의 journal-section이 제거되어 journal-tbody 요소가 없으므로 early return
  const tbody    = document.getElementById('journal-tbody');
  const emptyMsg = document.getElementById('journal-empty');
  if (!tbody) return;  // 요소가 없으면 (Tab A journal-section 제거 후) 안전하게 종료
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

/* ── 9-3b. RSI 계산 함수 (Wilder RSI 공식) ──────────────────────
   RSI = 100 - (100 / (1 + RS))  여기서 RS = 평균상승 / 평균하락
   Wilder 방식: 지수평활(EMA) 기반이라 초기 SMA 이후 지속 업데이트   */
function calcRSI(closes, period = 14) {
  // 데이터가 부족하면 중립값(50) 반환
  if (closes.length < period + 1) return { rsiValues: [], currentRSI: 50 };

  // 전봉 대비 변화량 계산
  const changes = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  // 최초 period봉의 평균 상승/하락으로 초기값 설정
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder 스무딩: (이전평균 * (period-1) + 현재값) / period
  const rsiValues = [];
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues.push(parseFloat((100 - 100 / (1 + rs)).toFixed(2)));
  }

  return { rsiValues, currentRSI: rsiValues[rsiValues.length - 1] ?? 50 };
}


/* ── 9-3c. RSI 구간(Bucket) 함수 ────────────────────────────────
   RSI 값을 5개 구간으로 분류 — BB_LOOKUP_RSI 키 매핑용 */
function getRSIBucket(rsi) {
  if (rsi < 30) return 'rsi_0_30';
  if (rsi < 40) return 'rsi_30_40';
  if (rsi < 60) return 'rsi_40_60';
  if (rsi < 70) return 'rsi_60_70';
  return 'rsi_70_100';
}

function getRSIBucketLabel(bucket) {
  const labels = {
    'rsi_0_30':   '과매도 (0-30)',
    'rsi_30_40':  '약세 중립 (30-40)',
    'rsi_40_60':  '중립 (40-60)',
    'rsi_60_70':  '강세 중립 (60-70)',
    'rsi_70_100': '과매수 (70-100)',
  };
  return labels[bucket] || bucket;
}


/* ── 9-3d. BB_LOOKUP_RSI — Z-score × RSI 2차원 통계 테이블 ──────
   기존 BB_LOOKUP의 Z-score 1차원에 RSI 구간을 더한 2D 룩업.
   rsiEVBoost: RSI 정보가 추가될 때의 기대값 변화
   filterImprovement: RSI 필터 적용 시 성공률 변화량               */
const BB_LOOKUP_RSI = {
  mean_reversion: {
    z_lt_neg2: {
      rsi_0_30:   { prob: 84, avgBars: 6,  ev: 1.9, evNoRSI: 1.4, winRate: 79, samples: 87,  rsiEVBoost: '+0.5R', filterImprovement: '+16%' },
      rsi_30_40:  { prob: 76, avgBars: 7,  ev: 1.5, evNoRSI: 1.4, winRate: 71, samples: 94,  rsiEVBoost: '+0.1R', filterImprovement: '+4%'  },
      rsi_40_60:  { prob: 68, avgBars: 9,  ev: 1.1, evNoRSI: 1.4, winRate: 64, samples: 67,  rsiEVBoost: '-0.3R', filterImprovement: '-8%'  },
      rsi_60_70:  { prob: 55, avgBars: 12, ev: 0.7, evNoRSI: 1.4, winRate: 52, samples: 24,  rsiEVBoost: '-0.7R', filterImprovement: '-21%' },
      rsi_70_100: { prob: 41, avgBars: 16, ev: 0.2, evNoRSI: 1.4, winRate: 40, samples: 12,  rsiEVBoost: '-1.2R', filterImprovement: '-35%' },
    },
    z_neg2_neg1_5: {
      rsi_0_30:   { prob: 79, avgBars: 7,  ev: 1.6, evNoRSI: 1.2, winRate: 75, samples: 102, rsiEVBoost: '+0.4R', filterImprovement: '+14%' },
      rsi_30_40:  { prob: 73, avgBars: 8,  ev: 1.3, evNoRSI: 1.2, winRate: 69, samples: 118, rsiEVBoost: '+0.1R', filterImprovement: '+3%'  },
      rsi_40_60:  { prob: 65, avgBars: 10, ev: 1.0, evNoRSI: 1.2, winRate: 61, samples: 89,  rsiEVBoost: '-0.2R', filterImprovement: '-6%'  },
      rsi_60_70:  { prob: 52, avgBars: 13, ev: 0.6, evNoRSI: 1.2, winRate: 49, samples: 31,  rsiEVBoost: '-0.6R', filterImprovement: '-18%' },
      rsi_70_100: { prob: 38, avgBars: 18, ev: 0.1, evNoRSI: 1.2, winRate: 37, samples: 15,  rsiEVBoost: '-1.1R', filterImprovement: '-32%' },
    },
    z_neg1_5_neg1: {
      rsi_0_30:   { prob: 72, avgBars: 8,  ev: 1.3, evNoRSI: 0.9, winRate: 68, samples: 78,  rsiEVBoost: '+0.4R', filterImprovement: '+12%' },
      rsi_30_40:  { prob: 67, avgBars: 9,  ev: 1.0, evNoRSI: 0.9, winRate: 63, samples: 143, rsiEVBoost: '+0.1R', filterImprovement: '+3%'  },
      rsi_40_60:  { prob: 61, avgBars: 11, ev: 0.8, evNoRSI: 0.9, winRate: 58, samples: 156, rsiEVBoost: '-0.1R', filterImprovement: '-3%'  },
      rsi_60_70:  { prob: 49, avgBars: 14, ev: 0.4, evNoRSI: 0.9, winRate: 46, samples: 47,  rsiEVBoost: '-0.5R', filterImprovement: '-15%' },
      rsi_70_100: { prob: 36, avgBars: 19, ev: 0.0, evNoRSI: 0.9, winRate: 34, samples: 22,  rsiEVBoost: '-0.9R', filterImprovement: '-28%' },
    },
    z_neg1_0: {
      rsi_0_30:   { prob: 65, avgBars: 10, ev: 1.0, evNoRSI: 0.6, winRate: 61, samples: 54,  rsiEVBoost: '+0.4R', filterImprovement: '+10%' },
      rsi_30_40:  { prob: 60, avgBars: 11, ev: 0.7, evNoRSI: 0.6, winRate: 56, samples: 167, rsiEVBoost: '+0.1R', filterImprovement: '+2%'  },
      rsi_40_60:  { prob: 56, avgBars: 12, ev: 0.5, evNoRSI: 0.6, winRate: 53, samples: 289, rsiEVBoost: '-0.1R', filterImprovement: '-2%'  },
      rsi_60_70:  { prob: 44, avgBars: 15, ev: 0.2, evNoRSI: 0.6, winRate: 42, samples: 87,  rsiEVBoost: '-0.4R', filterImprovement: '-10%' },
      rsi_70_100: { prob: 32, avgBars: 20, ev: -0.1, evNoRSI: 0.6, winRate: 31, samples: 34, rsiEVBoost: '-0.7R', filterImprovement: '-20%' },
    },
    z_0_pos1: {
      rsi_0_30:   { prob: 62, avgBars: 11, ev: 0.8, evNoRSI: 0.5, winRate: 58, samples: 43,  rsiEVBoost: '+0.3R', filterImprovement: '+8%'  },
      rsi_30_40:  { prob: 57, avgBars: 12, ev: 0.6, evNoRSI: 0.5, winRate: 53, samples: 112, rsiEVBoost: '+0.1R', filterImprovement: '+2%'  },
      rsi_40_60:  { prob: 53, avgBars: 13, ev: 0.4, evNoRSI: 0.5, winRate: 50, samples: 312, rsiEVBoost: '-0.1R', filterImprovement: '-2%'  },
      rsi_60_70:  { prob: 47, avgBars: 16, ev: 0.1, evNoRSI: 0.5, winRate: 44, samples: 97,  rsiEVBoost: '-0.4R', filterImprovement: '-10%' },
      rsi_70_100: { prob: 35, avgBars: 21, ev: -0.2, evNoRSI: 0.5, winRate: 33, samples: 41, rsiEVBoost: '-0.7R', filterImprovement: '-18%' },
    },
    z_pos1_pos1_5: {
      rsi_0_30:   { prob: 60, avgBars: 9,  ev: 0.9, evNoRSI: 0.9, winRate: 56, samples: 38,  rsiEVBoost: '+0.0R', filterImprovement: '+0%'  },
      rsi_30_40:  { prob: 65, avgBars: 10, ev: 1.1, evNoRSI: 0.9, winRate: 61, samples: 87,  rsiEVBoost: '+0.2R', filterImprovement: '+5%'  },
      rsi_40_60:  { prob: 62, avgBars: 11, ev: 0.9, evNoRSI: 0.9, winRate: 58, samples: 198, rsiEVBoost: '+0.0R', filterImprovement: '+0%'  },
      rsi_60_70:  { prob: 71, avgBars: 8,  ev: 1.3, evNoRSI: 0.9, winRate: 67, samples: 76,  rsiEVBoost: '+0.4R', filterImprovement: '+11%' },
      rsi_70_100: { prob: 79, avgBars: 7,  ev: 1.6, evNoRSI: 0.9, winRate: 74, samples: 52,  rsiEVBoost: '+0.7R', filterImprovement: '+18%' },
    },
    z_pos1_5_pos2: {
      rsi_0_30:   { prob: 41, avgBars: 16, ev: 0.2, evNoRSI: 1.2, winRate: 39, samples: 18,  rsiEVBoost: '-1.0R', filterImprovement: '-28%' },
      rsi_30_40:  { prob: 58, avgBars: 10, ev: 0.9, evNoRSI: 1.2, winRate: 54, samples: 43,  rsiEVBoost: '-0.3R', filterImprovement: '-9%'  },
      rsi_40_60:  { prob: 66, avgBars: 9,  ev: 1.1, evNoRSI: 1.2, winRate: 62, samples: 134, rsiEVBoost: '-0.1R', filterImprovement: '-3%'  },
      rsi_60_70:  { prob: 75, avgBars: 7,  ev: 1.5, evNoRSI: 1.2, winRate: 71, samples: 89,  rsiEVBoost: '+0.3R', filterImprovement: '+9%'  },
      rsi_70_100: { prob: 82, avgBars: 6,  ev: 1.8, evNoRSI: 1.2, winRate: 78, samples: 67,  rsiEVBoost: '+0.6R', filterImprovement: '+17%' },
    },
    z_gt_pos2: {
      rsi_0_30:   { prob: 38, avgBars: 18, ev: 0.1, evNoRSI: 1.4, winRate: 37, samples: 9,   rsiEVBoost: '-1.3R', filterImprovement: '-38%' },
      rsi_30_40:  { prob: 52, avgBars: 13, ev: 0.7, evNoRSI: 1.4, winRate: 49, samples: 28,  rsiEVBoost: '-0.7R', filterImprovement: '-20%' },
      rsi_40_60:  { prob: 65, avgBars: 9,  ev: 1.1, evNoRSI: 1.4, winRate: 61, samples: 71,  rsiEVBoost: '-0.3R', filterImprovement: '-9%'  },
      rsi_60_70:  { prob: 78, avgBars: 7,  ev: 1.6, evNoRSI: 1.4, winRate: 74, samples: 94,  rsiEVBoost: '+0.2R', filterImprovement: '+7%'  },
      rsi_70_100: { prob: 85, avgBars: 5,  ev: 1.9, evNoRSI: 1.4, winRate: 81, samples: 88,  rsiEVBoost: '+0.5R', filterImprovement: '+15%' },
    },
  },
  trend: {
    z_lt_neg2: {
      rsi_0_30:   { prob: 72, avgBars: 8,  ev: 1.3, evNoRSI: 0.8, winRate: 68, samples: 45,  rsiEVBoost: '+0.5R', filterImprovement: '+14%' },
      rsi_30_40:  { prob: 65, avgBars: 9,  ev: 1.0, evNoRSI: 0.8, winRate: 61, samples: 62,  rsiEVBoost: '+0.2R', filterImprovement: '+5%'  },
      rsi_40_60:  { prob: 55, avgBars: 12, ev: 0.6, evNoRSI: 0.8, winRate: 52, samples: 78,  rsiEVBoost: '-0.2R', filterImprovement: '-6%'  },
      rsi_60_70:  { prob: 42, avgBars: 16, ev: 0.2, evNoRSI: 0.8, winRate: 40, samples: 34,  rsiEVBoost: '-0.6R', filterImprovement: '-17%' },
      rsi_70_100: { prob: 31, avgBars: 22, ev: -0.2, evNoRSI: 0.8, winRate: 30, samples: 19, rsiEVBoost: '-1.0R', filterImprovement: '-28%' },
    },
    z_neg2_neg1_5: {
      rsi_0_30:   { prob: 68, avgBars: 9,  ev: 1.1, evNoRSI: 0.7, winRate: 64, samples: 58,  rsiEVBoost: '+0.4R', filterImprovement: '+11%' },
      rsi_30_40:  { prob: 62, avgBars: 10, ev: 0.9, evNoRSI: 0.7, winRate: 58, samples: 87,  rsiEVBoost: '+0.2R', filterImprovement: '+5%'  },
      rsi_40_60:  { prob: 53, avgBars: 13, ev: 0.5, evNoRSI: 0.7, winRate: 50, samples: 134, rsiEVBoost: '-0.2R', filterImprovement: '-5%'  },
      rsi_60_70:  { prob: 40, avgBars: 17, ev: 0.1, evNoRSI: 0.7, winRate: 38, samples: 43,  rsiEVBoost: '-0.6R', filterImprovement: '-16%' },
      rsi_70_100: { prob: 29, avgBars: 23, ev: -0.3, evNoRSI: 0.7, winRate: 28, samples: 21, rsiEVBoost: '-1.0R', filterImprovement: '-27%' },
    },
    z_neg1_5_neg1: {
      rsi_0_30:   { prob: 61, avgBars: 11, ev: 0.8, evNoRSI: 0.5, winRate: 57, samples: 47,  rsiEVBoost: '+0.3R', filterImprovement: '+8%'  },
      rsi_30_40:  { prob: 56, avgBars: 12, ev: 0.6, evNoRSI: 0.5, winRate: 52, samples: 98,  rsiEVBoost: '+0.1R', filterImprovement: '+3%'  },
      rsi_40_60:  { prob: 50, avgBars: 14, ev: 0.3, evNoRSI: 0.5, winRate: 47, samples: 187, rsiEVBoost: '-0.2R', filterImprovement: '-5%'  },
      rsi_60_70:  { prob: 38, avgBars: 18, ev: -0.1, evNoRSI: 0.5, winRate: 36, samples: 56, rsiEVBoost: '-0.6R', filterImprovement: '-14%' },
      rsi_70_100: { prob: 28, avgBars: 24, ev: -0.4, evNoRSI: 0.5, winRate: 27, samples: 27, rsiEVBoost: '-0.9R', filterImprovement: '-24%' },
    },
    z_neg1_0: {
      rsi_0_30:   { prob: 55, avgBars: 13, ev: 0.6, evNoRSI: 0.3, winRate: 51, samples: 38,  rsiEVBoost: '+0.3R', filterImprovement: '+7%'  },
      rsi_30_40:  { prob: 51, avgBars: 14, ev: 0.4, evNoRSI: 0.3, winRate: 48, samples: 134, rsiEVBoost: '+0.1R', filterImprovement: '+2%'  },
      rsi_40_60:  { prob: 48, avgBars: 15, ev: 0.2, evNoRSI: 0.3, winRate: 45, samples: 267, rsiEVBoost: '-0.1R', filterImprovement: '-2%'  },
      rsi_60_70:  { prob: 36, avgBars: 19, ev: -0.2, evNoRSI: 0.3, winRate: 34, samples: 78, rsiEVBoost: '-0.5R', filterImprovement: '-12%' },
      rsi_70_100: { prob: 26, avgBars: 25, ev: -0.5, evNoRSI: 0.3, winRate: 25, samples: 39, rsiEVBoost: '-0.8R', filterImprovement: '-20%' },
    },
    z_0_pos1: {
      rsi_0_30:   { prob: 27, avgBars: 24, ev: -0.4, evNoRSI: 0.3, winRate: 26, samples: 34, rsiEVBoost: '-0.7R', filterImprovement: '-19%' },
      rsi_30_40:  { prob: 38, avgBars: 18, ev: 0.0, evNoRSI: 0.3, winRate: 36, samples: 89,  rsiEVBoost: '-0.3R', filterImprovement: '-8%'  },
      rsi_40_60:  { prob: 50, avgBars: 14, ev: 0.3, evNoRSI: 0.3, winRate: 47, samples: 312, rsiEVBoost: '+0.0R', filterImprovement: '+0%'  },
      rsi_60_70:  { prob: 62, avgBars: 10, ev: 0.8, evNoRSI: 0.3, winRate: 58, samples: 97,  rsiEVBoost: '+0.5R', filterImprovement: '+13%' },
      rsi_70_100: { prob: 71, avgBars: 8,  ev: 1.2, evNoRSI: 0.3, winRate: 67, samples: 54,  rsiEVBoost: '+0.9R', filterImprovement: '+22%' },
    },
    z_pos1_pos1_5: {
      rsi_0_30:   { prob: 29, avgBars: 22, ev: -0.3, evNoRSI: 0.7, winRate: 28, samples: 22, rsiEVBoost: '-1.0R', filterImprovement: '-26%' },
      rsi_30_40:  { prob: 43, avgBars: 16, ev: 0.2, evNoRSI: 0.7, winRate: 40, samples: 67,  rsiEVBoost: '-0.5R', filterImprovement: '-13%' },
      rsi_40_60:  { prob: 58, avgBars: 11, ev: 0.7, evNoRSI: 0.7, winRate: 54, samples: 178, rsiEVBoost: '+0.0R', filterImprovement: '+0%'  },
      rsi_60_70:  { prob: 70, avgBars: 8,  ev: 1.2, evNoRSI: 0.7, winRate: 66, samples: 89,  rsiEVBoost: '+0.5R', filterImprovement: '+13%' },
      rsi_70_100: { prob: 78, avgBars: 6,  ev: 1.6, evNoRSI: 0.7, winRate: 74, samples: 63,  rsiEVBoost: '+0.9R', filterImprovement: '+22%' },
    },
    z_pos1_5_pos2: {
      rsi_0_30:   { prob: 33, avgBars: 20, ev: -0.1, evNoRSI: 0.8, winRate: 31, samples: 17, rsiEVBoost: '-0.9R', filterImprovement: '-23%' },
      rsi_30_40:  { prob: 48, avgBars: 14, ev: 0.4, evNoRSI: 0.8, winRate: 45, samples: 54,  rsiEVBoost: '-0.4R', filterImprovement: '-11%' },
      rsi_40_60:  { prob: 62, avgBars: 10, ev: 0.9, evNoRSI: 0.8, winRate: 58, samples: 134, rsiEVBoost: '+0.1R', filterImprovement: '+3%'  },
      rsi_60_70:  { prob: 74, avgBars: 7,  ev: 1.4, evNoRSI: 0.8, winRate: 70, samples: 87,  rsiEVBoost: '+0.6R', filterImprovement: '+16%' },
      rsi_70_100: { prob: 82, avgBars: 5,  ev: 1.8, evNoRSI: 0.8, winRate: 78, samples: 71,  rsiEVBoost: '+1.0R', filterImprovement: '+25%' },
    },
    z_gt_pos2: {
      rsi_0_30:   { prob: 35, avgBars: 19, ev: 0.0, evNoRSI: 0.8, winRate: 33, samples: 12,  rsiEVBoost: '-0.8R', filterImprovement: '-21%' },
      rsi_30_40:  { prob: 50, avgBars: 13, ev: 0.5, evNoRSI: 0.8, winRate: 47, samples: 38,  rsiEVBoost: '-0.3R', filterImprovement: '-9%'  },
      rsi_40_60:  { prob: 64, avgBars: 9,  ev: 1.0, evNoRSI: 0.8, winRate: 60, samples: 89,  rsiEVBoost: '+0.2R', filterImprovement: '+6%'  },
      rsi_60_70:  { prob: 76, avgBars: 6,  ev: 1.5, evNoRSI: 0.8, winRate: 72, samples: 97,  rsiEVBoost: '+0.7R', filterImprovement: '+19%' },
      rsi_70_100: { prob: 84, avgBars: 5,  ev: 1.9, evNoRSI: 0.8, winRate: 80, samples: 84,  rsiEVBoost: '+1.1R', filterImprovement: '+28%' },
    },
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


/* ── BB_LOOKUP_RSI용 Z-score 키 매핑 함수 ────────────────────────
   BB_LOOKUP_RSI는 BB_LOOKUP과 키 이름이 다르므로 별도 매핑 필요 */
function getZScoreKeyForRSI(z) {
  if (z < -2.0)  return 'z_lt_neg2';
  if (z < -1.5)  return 'z_neg2_neg1_5';
  if (z < -1.0)  return 'z_neg1_5_neg1';
  if (z <  0)    return 'z_neg1_0';
  if (z <  1.0)  return 'z_0_pos1';
  if (z <  1.5)  return 'z_pos1_pos1_5';
  if (z <  2.0)  return 'z_pos1_5_pos2';
  return 'z_gt_pos2';
}


/* ── 9-4b. calcRegimeScore — 3분류 레짐 점수 기반 판별 ──────────
   ADX Proxy(BB 폭/ATR 비율) + EMA 방향 + RSI 편향을 가중합산하여
   추세장 / 전환장 / 박스장을 구분한다.
   레짐에 따라 어떤 전략(추세추종 vs 평균회귀)이 유리한지 결정됨   */
function calcRegimeScore(bb, rsiValue) {
  // BB 폭을 ATR로 나눈 비율 → 변동성 대비 밴드 확장 정도(ADX 대리 지표)
  const bwRatio  = bb.bandwidth > 0 && bb.atr > 0 ? (bb.bandwidth * bb.currentPrice) / bb.atr : 1;
  const adxProxy = Math.min(100, (bwRatio / 5) * 100);
  // ADX 대리값 구간별 점수: 60 초과=강한 추세, 30~60=중립, 30 미만=박스
  const adxScore  = adxProxy > 60 ? 100 : adxProxy > 30 ? 50 : 0;
  // 현재가가 MA 위 → 상승 추세 편향(70점), 아래 → 하락 편향(30점)
  const emaScore  = bb.currentPrice > bb.ma ? 70 : 30;
  // RSI가 50에서 멀수록 방향성 편향이 강함 → 추세 요소로 활용
  const rsiBiasScore = Math.abs(rsiValue - 50) * 2;
  // 가중합: ADX 40% + EMA 방향 30% + RSI 편향 30%
  const regimeScore  = 0.4 * adxScore + 0.3 * emaScore + 0.3 * rsiBiasScore;

  if (regimeScore > 65) return { type: 'trend',      score: Math.round(regimeScore), label: '추세장',         legacy: 'trend'          };
  if (regimeScore > 35) return { type: 'transition', score: Math.round(regimeScore), label: '전환장',         legacy: 'mean_reversion' };
  return                       { type: 'range',      score: Math.round(regimeScore), label: '박스장',         legacy: 'mean_reversion' };
}


/* ── 9-4c. checkEntryFilter — 진입 필터 3조건 체크 ────────────────
   완전한 진입 신호는 3가지 조건이 모두 만족되어야 함:
   1) Z-score 조건: 충분히 밴드 밖으로 이탈
   2) RSI 조건: 방향에 맞는 과매도/과매수 상태
   3) Regime 조건: 박스장(평균회귀 전략에 적합)이어야 함              */
function checkEntryFilter(direction, zScore, rsiValue, regimeType) {
  if (direction === 'long') {
    const zOK   = zScore < -2.2;    // 하단밴드 충분히 이탈 → 과매도 진입 적합
    const rsiOK = rsiValue < 30;    // RSI 과매도 구간 → 반등 기대
    const regOK = regimeType === 'range';  // 박스장에서 평균회귀가 유리
    return { zOK, rsiOK, regOK, allPass: zOK && rsiOK && regOK };
  } else {
    const zOK   = zScore > 2.2;     // 상단밴드 충분히 이탈 → 과매수 진입 적합
    const rsiOK = rsiValue > 70;    // RSI 과매수 구간 → 하락 기대
    const regOK = regimeType === 'range';
    return { zOK, rsiOK, regOK, allPass: zOK && rsiOK && regOK };
  }
}


/* ── 9-4d. detectSimpleDivergence — 단순 다이버전스 감지 ────────────
   다이버전스: 가격과 RSI가 반대 방향으로 움직이는 상태
   - 롱 포지션 중 가격 하락 + RSI 상승 → 강도 약화 신호 (조기 청산 고려)
   - 숏 포지션 중 가격 상승 + RSI 하락 → 강도 약화 신호                */
function detectSimpleDivergence(direction, rsiHistory) {
  if (rsiHistory.length < 5) return false;
  const recent = rsiHistory.slice(-5);
  if (direction === 'long') {
    const priceFalling = recent[recent.length - 1] < recent[0];  // RSI 히스토리로 가격 방향 근사
    const rsiRising    = recent[recent.length - 1] > recent[0];
    return priceFalling && rsiRising;
  } else {
    const priceRising = recent[recent.length - 1] > recent[0];
    const rsiFalling  = recent[recent.length - 1] < recent[0];
    return priceRising && rsiFalling;
  }
}


/* ── 9-4e. calcExitAdvice — RSI 기반 청산 조언 생성 ────────────────
   보유 중인 포지션을 언제 어떻게 청산할지 RSI로 보조 결정.
   - RSI 50 돌파 시 부분청산(절반 익절)으로 리스크 축소
   - RSI 극단 지속 시 TP 확장으로 추가 이익 노림
   - 다이버전스 감지 시 조기청산 또는 트레일링으로 전환              */
function calcExitAdvice(direction, rsiValue, rsiHistory) {
  const advice = [];
  if (direction === 'long'  && rsiValue > 50) advice.push('RSI 50 돌파 -> 50% 부분청산 고려');
  if (direction === 'short' && rsiValue < 50) advice.push('RSI 50 하락 -> 50% 부분청산 고려');
  if (direction === 'long'  && rsiValue > 70) advice.push('RSI 과열 지속 -> TP 1.3배 확장 고려');
  if (direction === 'short' && rsiValue < 30) advice.push('RSI 과매도 지속 -> TP 1.3배 확장 고려');
  if (detectSimpleDivergence(direction, rsiHistory)) advice.push('RSI 다이버전스 감지 -> TP 조기청산 또는 트레일링 전환 고려');
  return advice;
}


/* ── 9-4f. getConfidenceLabel — 샘플 수 기반 신뢰도 표시 ─────────────
   샘플이 적을수록 통계가 불안정하므로 신뢰도를 함께 표시해 과신 방지 */
function getConfidenceLabel(samples) {
  if (samples >= 100) return { label: '높음',         color: 'var(--green)'  };
  if (samples >= 50)  return { label: '보통',         color: 'var(--yellow)' };
  if (samples >= 30)  return { label: '낮음',         color: 'var(--orange)' };
  return                     { label: '불충분 (< 30)', color: 'var(--red)'   };
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

// RSI 히스토리를 전역으로 관리 — 다이버전스 감지에 재활용
window.rsiHistory = [];

async function generateSignal(direction) {
  // 차트 데이터 없으면 안내
  if (!currentChartData || currentChartData.length < 25) {
    appendMessage('assistant', '차트 데이터를 먼저 불러와 주세요. 최소 25봉이 필요합니다.');
    return;
  }

  const period  = parseInt(document.getElementById('bb-period').value) || 20;
  const stdMult = parseFloat(document.getElementById('bb-std').value) || 2.0;

  // 볼린저밴드 계산
  const bb = calcBollingerBand(currentChartData, period, stdMult);
  if (!bb) {
    appendMessage('assistant', `볼린저밴드 계산 실패 — 데이터가 부족합니다. (필요: ${period}봉 이상)`);
    return;
  }

  // ── RSI 계산 ────────────────────────────────────────────────────
  // 종가 배열로 RSI(14) 계산 후 전역 히스토리 갱신
  const closes = currentChartData.map(c => c.close);
  const rsiResult  = calcRSI(closes, 14);
  const rsiValue   = rsiResult.currentRSI;
  window.rsiHistory = rsiResult.rsiValues;  // 다이버전스 감지용 저장

  // RSI 구간(bucket) 결정 — BB_LOOKUP_RSI 키 매핑
  const rsiBucket  = getRSIBucket(rsiValue);
  const rsiLabel   = getRSIBucketLabel(rsiBucket);

  // ── 레짐 판별 (새 3분류 방식) ───────────────────────────────────
  // 기존 2분류(trend/mean_reversion) → 3분류(trend/transition/range)로 업그레이드
  const regimeInfo = calcRegimeScore(bb, rsiValue);

  // BB_LOOKUP_RSI 조회 — Z-score × RSI 2D 테이블
  // transition 타입은 legacy 필드(mean_reversion 또는 trend)로 BB_LOOKUP_RSI 키 매핑
  const rsiZKey   = getZScoreKeyForRSI(bb.zScore);
  const lookupKey = regimeInfo.legacy;  // 'trend' 또는 'mean_reversion'
  const rsiStats  = BB_LOOKUP_RSI[lookupKey]?.[rsiZKey]?.[rsiBucket] || null;

  // 기존 BB_LOOKUP 통계 (레거시 호환)
  const legacyRegime = regimeInfo.legacy;
  const zKey         = getZScoreKey(bb.zScore);
  const stats        = BB_LOOKUP[legacyRegime][zKey];

  // Entry / TP / SL 계산
  const levels = calcSignalLevels(direction, bb);

  // ── 엔트리 직접입력 값 적용 ────────────────────────────────────────
  // 사용자가 입력한 값이 있으면 자동 계산값 대신 사용
  // 빈 값이거나 0 이하면 자동 계산값(현재가) 유지
  const entryOverrideVal = parseFloat(document.getElementById('entry-override')?.value);
  if (!isNaN(entryOverrideVal) && entryOverrideVal > 0) {
    levels.entry = entryOverrideVal;
    // entry가 바뀌었으므로 R:R도 재계산 (reward/risk 비율 유지)
    const reward = Math.abs(levels.tp - levels.entry);
    const risk   = Math.abs(levels.entry - levels.sl);
    levels.rr    = risk > 0 ? reward / risk : 0;
  }

  // 엔트리 입력창에 실제 사용된 entry 값 표시 (비어있을 때만)
  const entryOverrideEl = document.getElementById('entry-override');
  if (entryOverrideEl && !entryOverrideEl.value) {
    entryOverrideEl.value = levels.entry;
  }

  // 차트에 라인 그리기
  drawSignalLines(levels.entry, levels.tp, levels.sl, direction);

  // ── 진입 필터 체크 ───────────────────────────────────────────────
  // 3조건(Z-score, RSI, Regime) 모두 통과해야 고확률 진입
  const filter = checkEntryFilter(direction, bb.zScore, rsiValue, regimeInfo.type);

  // ── Exit 보조 로직 계산 ──────────────────────────────────────────
  const exitAdvice = calcExitAdvice(direction, rsiValue, window.rsiHistory);

  // ── 신뢰도 레이블 ────────────────────────────────────────────────
  const confidence = rsiStats ? getConfidenceLabel(rsiStats.samples) : { label: '—', color: 'var(--text-muted)' };

  // 신호 데이터 전역 저장 (Phase 3 프리필 연동용)
  lastSignalData = {
    ticker:     currentTicker,
    direction:  direction === 'long' ? '롱' : '숏',
    entry:      levels.entry,
    stop_loss:  levels.sl,
    tp1:        levels.tp,
    bb,
    regime:     legacyRegime,
    regimeInfo,
    stats,
    rsiStats,
    rsiValue,
    levels,
  };

  // 레짐 한국어 표기 (3분류)
  const regimeLabel = regimeInfo.label;   // '추세장' / '전환장' / '박스장'
  const dirKo       = direction === 'long' ? '롱 (매수)' : '숏 (매도)';

  // 진입 필터 방향 레이블
  const zCheck   = direction === 'long' ? '< -2.2' : '> +2.2';
  const rsiCheck = direction === 'long' ? '< 30 (과매도)' : '> 70 (과매수)';

  // ── 채팅창에 통계 근거 텍스트 자동 출력 ────────────────────────
  const rsiSection = rsiStats ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━
[RSI 통계 엔진]
현재 RSI(14): ${rsiValue.toFixed(1)} -> ${rsiLabel}
RSI 포함 기대값: ${rsiStats.ev > 0 ? '+' : ''}${rsiStats.ev}R | 미포함: ${rsiStats.evNoRSI > 0 ? '+' : ''}${rsiStats.evNoRSI}R
EV 변화: ${rsiStats.rsiEVBoost} | 성공확률: ${rsiStats.filterImprovement}
샘플 수: ${rsiStats.samples}건 | 신뢰도: ${confidence.label}

[Entry Filter 체크]
Z-score ${zCheck}: ${filter.zOK ? 'PASS' : 'FAIL'} (현재: ${bb.zScore.toFixed(2)})
RSI ${rsiCheck}: ${filter.rsiOK ? 'PASS' : 'FAIL'} (현재: ${rsiValue.toFixed(1)})
Regime = 박스장: ${filter.regOK ? 'PASS' : 'FAIL'} (현재: ${regimeLabel})
${filter.allPass ? '-> 전체 조건 통과 -- 진입 적합' : '-> 일부 조건 미충족 -- 진입 재검토 필요'}

[Exit 보조 로직]
${exitAdvice.length > 0 ? exitAdvice.join('\n') : '- 특이사항 없음'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━` : `
RSI 통계: 해당 Z-score × RSI 셀 데이터 없음`;

  const signalText =
`=== ${dirKo} 신호 분석 (볼린저밴드 + RSI) ===

[현재 시장 상태]
- 종목: ${currentTicker}
- 현재가: ${bb.currentPrice.toLocaleString()}
- MA(${period}): ${bb.ma.toFixed(4)}
- 상단밴드: ${bb.upper.toFixed(4)}
- 하단밴드: ${bb.lower.toFixed(4)}
- Z-score: ${bb.zScore.toFixed(2)} (${zKey})
- Bandwidth: ${(bb.bandwidth * 100).toFixed(2)}%
- ATR: ${bb.atr.toFixed(4)}
- 레짐 판별: ${regimeLabel} (점수: ${regimeInfo.score})

[통계 근거 (BB 룩업 테이블)]
- 평균회귀 확률: ${stats.prob}%
- 평균 복귀 소요 봉수: ${stats.avgBars}봉
- 기대값(EV): ${stats.ev > 0 ? '+' : ''}${stats.ev}R
- 승률: ${stats.winRate}%
- 샘플 수: ${stats.samples}건
${rsiSection}
[신호 레벨]
- Entry: ${levels.entry.toLocaleString()}
- TP (목표가): ${levels.tp.toLocaleString()}
- SL (손절가): ${levels.sl.toLocaleString()}
- R:R = 1:${levels.rr.toFixed(2)}

차트에 Entry(파란 점선) / TP(초록선) / SL(빨간선)이 표시되었습니다.`;

  appendMessage('assistant', signalText);

  // ── Monte Carlo 리스크 시뮬레이션 자동 실행 ─────────────────────────
  // 신호 생성 직후 백그라운드로 시뮬레이션 요청 (채팅 응답 후 비동기 실행)
  // 캐싱 키: 종목 + Z구간 + RSI구간 + 레짐 조합 → 같은 조건 재요청 시 캐시 사용
  const simCacheKey = `${currentTicker}_${rsiZKey}_${rsiBucket}_${regimeInfo.type}`;
  const simWinRate  = rsiStats ? (rsiStats.winRate / 100) : (stats.winRate / 100);
  const simEV       = rsiStats ? rsiStats.ev : stats.ev;
  // EV에서 역산: EV = winRate * avgWin - (1-winRate) * avgLoss
  // avgWin = (EV + (1-winRate)*avgLoss) / winRate 로 근사 (avgLoss=1R 고정)
  const simAvgLoss  = 1.0;
  const simAvgWin   = simWinRate > 0
    ? (simEV + (1 - simWinRate) * simAvgLoss) / simWinRate
    : 1.5;
  const simN        = Math.max(stats.samples, 30);  // 샘플이 작으면 30으로 올림

  runMonteCarloSim({
    win_rate:   simWinRate,
    avg_win_R:  Math.max(0.1, simAvgWin),   // 음수 방지
    avg_loss_R: simAvgLoss,
    n_trades:   simN,
    leverage:   1,
    runs:       1000,
    cache_key:  simCacheKey,
  });
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

// 3-TF 패널 본문 접기/펼치기 토글 버튼
// 헤더는 유지하면서 카드 + Risk Sim 영역만 숨김/표시
document.getElementById('tf-body-toggle-btn')?.addEventListener('click', () => {
  const tfCards = document.getElementById('tf-cards');
  const btn     = document.getElementById('tf-body-toggle-btn');
  const riskSim = document.getElementById('risk-sim-section');

  // 현재 접혀 있는지 확인 (display:none이면 접힌 상태)
  const isCollapsed = tfCards && tfCards.style.display === 'none';

  if (isCollapsed) {
    // 펼치기: 카드와 Risk Sim 다시 표시
    if (tfCards)  tfCards.style.display = 'grid';
    // Risk Sim은 데이터가 있을 때만 표시 (신호 생성 전엔 숨김 유지)
    if (riskSim && riskSim.dataset.hasData === 'true') {
      riskSim.style.display = 'block';
    }
    btn.textContent = '▼ 접기';
  } else {
    // 접기: 카드와 Risk Sim 숨김
    if (tfCards)  tfCards.style.display = 'none';
    if (riskSim)  riskSim.style.display = 'none';
    btn.textContent = '▶ 펼치기';
  }
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

      // 각 TF에도 RSI를 계산해 레짐을 3분류로 판별 (일관성 유지)
      const tfCloses     = data.map(c => c.close);
      const tfRsiResult  = calcRSI(tfCloses, 14);
      const tfRsiValue   = tfRsiResult.currentRSI;
      const tfRegimeInfo = calcRegimeScore(bb, tfRsiValue);
      const regimeKo     = tfRegimeInfo.label;  // '추세장' / '전환장' / '박스장'
      const evClass      = stats.ev >= 0 ? 'green' : 'red';
      const rrClass      = levels.rr >= 1.5 ? 'green' : 'yellow';

      // Entry / SL을 카드 상단 아이콘 배너로 표시 (가독성 개선 — TP는 테이블로 이동)
      // TP 아이콘을 제거하고 Entry + SL만 아이콘으로, TP는 통계 테이블 행으로 표시
      card.innerHTML = `
        <div class="tf-card-title">${tf.label}</div>
        <!-- Entry/SL 아이콘 배너 — TP 아이콘 제거로 1시간봉 TP 1개 원칙과 가독성 향상 -->
        <div class="tf-icon-bar">
          <div class="tf-icon-item entry-icon">
            <span class="tf-icon-label">Entry</span>
            <span class="tf-icon-value">${levels.entry.toLocaleString()}</span>
          </div>
          <div class="tf-icon-item sl-icon">
            <span class="tf-icon-label">SL</span>
            <span class="tf-icon-value">${levels.sl.toLocaleString()}</span>
          </div>
        </div>
        <!-- 통계 테이블 — TP를 테이블 행으로 표시 (각 TF별 1개로 명확히 구분) -->
        <table class="tf-card-table">
          <tr><td>현재가</td><td><strong>${bb.currentPrice.toLocaleString()}</strong></td></tr>
          <tr><td>Z-score</td><td>${bb.zScore.toFixed(2)}</td></tr>
          <tr><td>RSI(14)</td><td>${tfRsiValue.toFixed(1)}</td></tr>
          <tr><td>레짐</td><td>${regimeKo}</td></tr>
          <tr><td>TP (목표가)</td><td class="green">${levels.tp.toLocaleString()}</td></tr>
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

// AI 분석 패널 접기/펼치기 토글
// 채팅 패널 본문(model-toggle, 메시지, 입력창)을 숨기고 그리드 컬럼 폭 축소
document.getElementById('chat-collapse-btn')?.addEventListener('click', () => {
  const grid = document.getElementById('main-grid');
  const btn  = document.getElementById('chat-collapse-btn');
  const isCollapsed = grid.classList.contains('chat-collapsed');

  if (isCollapsed) {
    // 펼치기: 채팅 패널 복원
    grid.classList.remove('chat-collapsed');
    btn.textContent = '◀ 접기';
  } else {
    // 접기: 채팅 패널 본문 숨김 + 컬럼 폭 최소화
    grid.classList.add('chat-collapsed');
    btn.textContent = '▶ 펼치기';
  }

  // CSS transition 완료 후 차트 크기를 새 너비에 맞게 재조정
  // 그리드 컬럼이 변경되면 chart-container 너비가 바뀌므로 차트에 알려줘야 함
  setTimeout(() => {
    const w = Math.max(chartContainer.clientWidth, 300);
    const h = Math.max(chartContainer.clientHeight, 300);
    chart.applyOptions({ width: w, height: h });
    // RSI 서브차트도 너비 동기화
    if (window.rsiChart) {
      const rsiEl = document.getElementById('rsi-container');
      const rsiW  = Math.max(rsiEl ? rsiEl.clientWidth : w, 300);
      window.rsiChart.applyOptions({ width: rsiW });
    }
  }, 250);  // CSS transition 0.2s 완료 후 실행
});


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
   손익금액·손익률·R-multiple·수수료·메모·삭제 컬럼 표시
   수정 가능한 셀은 더블클릭 → input 전환 → blur/Enter 시 API 저장  */
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

  /* ── 인라인 편집 헬퍼 함수 ──────────────────────────────────────
     특정 <td>를 더블클릭 시 input/select로 전환하고
     포커스 아웃(blur) 또는 Enter 키로 저장,
     Escape 키로 취소하는 click-to-edit 패턴 구현              */
  function makeEditableCell(td, trade, field, displayVal, inputType = 'number') {
    td.classList.add('editable-cell');
    td.title = '더블클릭하여 수정';

    td.addEventListener('dblclick', () => {
      // 이미 편집 중이면 중복 실행 방지
      if (td.querySelector('input, select')) return;

      const originalText = td.innerHTML;  // 원본 HTML 저장 (취소 시 복원용)
      let input;

      if (field === 'result') {
        // 결과 필드는 select 드롭다운으로 편집
        input = document.createElement('select');
        ['win', 'loss', 'breakeven', 'open'].forEach(v => {
          const opt = document.createElement('option');
          opt.value = v;
          opt.textContent = { win: '승(win)', loss: '패(loss)', breakeven: '본전', open: '진행중' }[v] || v;
          if (v === trade[field]) opt.selected = true;
          input.appendChild(opt);
        });
      } else if (inputType === 'text') {
        // 텍스트 필드 (메모 등)는 일반 text input
        input = document.createElement('input');
        input.type  = 'text';
        input.value = trade[field] ?? '';
      } else {
        // 숫자 필드 (진입가, SL, TP1 등)
        input = document.createElement('input');
        input.type  = 'number';
        input.step  = 'any';
        input.value = trade[field] ?? '';
      }

      td.textContent = '';  // 기존 표시 지우고 input 삽입
      td.appendChild(input);
      input.focus();
      if (input.select) input.select(); // 전체 선택으로 빠른 수정

      // ── 저장 함수 ─────────────────────────────────────────────────
      const save = async () => {
        // 빈 값이면 원본 복원
        if (input.value === '') { td.innerHTML = originalText; return; }

        // 숫자 필드는 parseFloat, 텍스트는 그대로
        const newVal = (field === 'result' || inputType === 'text')
          ? input.value
          : parseFloat(input.value);

        if (inputType === 'number' && isNaN(newVal)) {
          td.innerHTML = originalText;
          return;
        }

        // PUT API 호출 시 기존 필수 필드도 함께 전송 (서버 validation 통과용)
        const payload = {
          ticker:    trade.ticker,
          direction: trade.direction,
          entry:     trade.entry,
          stop_loss: trade.stop_loss,
          result:    trade.result,
          pnl:       trade.pnl || '',
        };
        payload[field] = newVal;  // 수정된 필드만 덮어씀

        try {
          const res = await fetch(`/journal/${trade.id}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
          });
          if (res.ok) {
            trade[field] = newVal;  // 로컬 캐시도 업데이트 (즉각 반영)
            await refreshJournalTab();  // 전체 테이블 재렌더링
          } else {
            td.innerHTML = originalText;  // 실패 시 원본 복원
          }
        } catch {
          td.innerHTML = originalText;  // 네트워크 오류 시 원본 복원
        }
      };

      // blur(포커스 아웃) 시 저장
      input.addEventListener('blur', save);
      // 키보드 단축키: Enter=저장, Escape=취소
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { td.innerHTML = originalText; }
      });
    });
  }

  // ── 각 트레이드 행 렌더링 ───────────────────────────────────────
  for (const t of filtered) {
    const tr = document.createElement('tr');

    const resultClass = { win: 'green', loss: 'red', breakeven: 'yellow', open: 'blue' }[t.result] || '';
    const dirClass    = t.direction === '롱' ? 'green' : 'red';
    const time        = t.timestamp ? t.timestamp.slice(0, 10) : '—';

    // pnl_amount: 숫자가 있으면 우선 표시, 없으면 기존 pnl 문자열 표시
    const pnlAmt    = t.pnl_amount != null ? (t.pnl_amount >= 0 ? '+$' : '-$') + Math.abs(t.pnl_amount).toFixed(2) : (t.pnl || '—');
    const pnlPct    = t.pnl_pct   != null ? (t.pnl_pct >= 0 ? '+' : '') + t.pnl_pct.toFixed(2) + '%' : '—';
    const rMultiple = t.r_multiple != null ? (t.r_multiple >= 0 ? '+' : '') + t.r_multiple.toFixed(2) + 'R' : '—';
    const fee       = t.fee != null ? '$' + t.fee.toFixed(2) : '—';
    const pnlClass  = pnlAmt.startsWith('+') ? 'green' : (pnlAmt.startsWith('-') ? 'red' : '');

    // 행 생성 — 각 <td>를 별도로 만들어 인라인 편집 핸들러 연결
    const tdDate     = document.createElement('td'); tdDate.className = 'muted'; tdDate.textContent = time;
    const tdTicker   = document.createElement('td'); tdTicker.innerHTML = `<strong>${t.ticker || '—'}</strong>`;
    const tdDir      = document.createElement('td'); tdDir.className = dirClass; tdDir.textContent = t.direction === '롱' ? '▲ 롱' : '▼ 숏';
    const tdEntry    = document.createElement('td'); tdEntry.textContent = Number(t.entry).toLocaleString();
    const tdSl       = document.createElement('td'); tdSl.className = 'red'; tdSl.textContent = Number(t.stop_loss).toLocaleString();
    const tdTp1      = document.createElement('td'); tdTp1.className = 'green'; tdTp1.textContent = t.tp1 ? Number(t.tp1).toLocaleString() : '—';
    const tdLev      = document.createElement('td'); tdLev.textContent = (t.leverage || 1) + 'x';
    const tdContr    = document.createElement('td'); tdContr.textContent = t.contracts != null ? t.contracts : '—';
    const tdResult   = document.createElement('td'); tdResult.className = resultClass; tdResult.textContent = t.result || '—';
    const tdPnlAmt   = document.createElement('td'); tdPnlAmt.className = pnlClass; tdPnlAmt.textContent = pnlAmt;
    const tdPnlPct   = document.createElement('td'); tdPnlPct.className = pnlClass; tdPnlPct.textContent = pnlPct;
    const tdRMul     = document.createElement('td'); tdRMul.className = t.r_multiple >= 0 ? 'green' : 'red'; tdRMul.textContent = rMultiple;
    const tdFee      = document.createElement('td'); tdFee.className = 'muted'; tdFee.textContent = fee;
    const tdMemo     = document.createElement('td'); tdMemo.className = 'muted'; tdMemo.style.cssText = 'max-width:150px; overflow:hidden; text-overflow:ellipsis;'; tdMemo.title = t.memo || ''; tdMemo.textContent = t.memo || '—';
    const tdDel      = document.createElement('td'); tdDel.innerHTML = `<button class="btn-delete" onclick="deleteTrade('${t.id}')">삭제</button>`;

    // 수정 가능한 셀에 더블클릭 핸들러 연결
    // (날짜·ID·방향은 읽기 전용 — 데이터 일관성 보호)
    makeEditableCell(tdEntry,  t, 'entry',      t.entry);
    makeEditableCell(tdSl,     t, 'stop_loss',  t.stop_loss);
    makeEditableCell(tdTp1,    t, 'tp1',        t.tp1);
    makeEditableCell(tdLev,    t, 'leverage',   t.leverage);
    makeEditableCell(tdContr,  t, 'contracts',  t.contracts);
    makeEditableCell(tdResult, t, 'result',     t.result, 'select');
    makeEditableCell(tdPnlAmt, t, 'pnl_amount', t.pnl_amount);
    makeEditableCell(tdPnlPct, t, 'pnl_pct',   t.pnl_pct);
    makeEditableCell(tdRMul,   t, 'r_multiple', t.r_multiple);
    makeEditableCell(tdFee,    t, 'fee',        t.fee);
    makeEditableCell(tdMemo,   t, 'memo',       t.memo, 'text');

    // 행에 셀들 순서대로 추가
    [tdDate, tdTicker, tdDir, tdEntry, tdSl, tdTp1, tdLev, tdContr,
     tdResult, tdPnlAmt, tdPnlPct, tdRMul, tdFee, tdMemo, tdDel].forEach(td => tr.appendChild(td));

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


/* ── Monte Carlo 리스크 시뮬레이션 UI 렌더링 ────────────────────
   /simulate POST 요청 후 결과를 Risk Simulation 섹션에 표시.
   KPI 카드 4개 + 경고 배지로 리스크 수준을 직관적으로 안내.    */
async function runMonteCarloSim(params) {
  const section = document.getElementById('risk-sim-section');
  const kpiRow  = document.getElementById('risk-sim-kpis');
  const badges  = document.getElementById('risk-sim-badges');
  if (!section || !kpiRow || !badges) return;

  // 로딩 중 표시 — 섹션 보이기 + "계산 중..." 텍스트
  // data-has-data 속성으로 펼치기 시 표시 여부 결정 (토글 버튼과 연동)
  section.style.display = 'block';
  section.dataset.hasData = 'true';
  kpiRow.innerHTML = '<p style="font-size:11px; color:var(--text-muted); padding:4px 0; text-align:center;">시뮬레이션 중...</p>';
  badges.innerHTML = '';

  try {
    const res  = await fetch('/simulate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(params),
    });

    if (!res.ok) {
      kpiRow.innerHTML = `<p style="font-size:11px; color:var(--red); padding:4px;">서버 오류 (${res.status})</p>`;
      return;
    }

    const data = await res.json();

    // ── KPI 카드 4개 렌더링 ─────────────────────────────────────────
    // 경고 조건: Ruin > 10%, Worst 5% DD > 30%, Sample N < 100
    const kpis = [
      {
        label: 'Worst 5% DD',
        value: data.worst_95pct_dd_pct + '%',
        // 낙폭 30% 초과 시 위험 신호
        warn:  data.worst_95pct_dd_pct > 30,
      },
      {
        label: 'Ruin %',
        value: data.risk_of_ruin_pct + '%',
        // 파산 확률 10% 초과 시 위험 신호
        warn:  data.risk_of_ruin_pct > 10,
      },
      {
        label: 'Sample N',
        value: data.sample_n + '건',
        // 샘플 100건 미만 시 통계 신뢰도 낮음
        warn:  data.sample_n < 100,
      },
      {
        label: '신뢰도',
        value: data.sample_n >= 100 ? '높음' : data.sample_n >= 50 ? '보통' : '낮음',
        warn:  data.sample_n < 50,
      },
    ];

    kpiRow.innerHTML = kpis.map(k => `
      <div class="risk-sim-kpi">
        <span class="risk-sim-kpi-label">${k.label}</span>
        <span class="risk-sim-kpi-value ${k.warn ? 'warn' : ''}">${k.value}</span>
      </div>
    `).join('');

    // ── 경고 배지 생성 ─────────────────────────────────────────────
    // 위험 수준에 따라 danger(빨강) / warn(노랑) / ok(초록) 배지 표시
    const badgeList = [];

    if (data.risk_of_ruin_pct > 10) {
      badgeList.push({ cls: 'danger', text: `파산확률 ${data.risk_of_ruin_pct}% — 레버리지/포지션 재검토` });
    }
    if (data.worst_95pct_dd_pct > 30) {
      badgeList.push({ cls: 'warn', text: `Worst DD ${data.worst_95pct_dd_pct}% — 포지션 크기 축소 권장` });
    }
    if (data.sample_n < 100) {
      badgeList.push({ cls: 'warn', text: `샘플 N=${data.sample_n} — 통계 신뢰도 부족 (100건 이상 권장)` });
    }
    if (badgeList.length === 0) {
      // 모든 지표가 정상 범위일 때 초록 OK 배지
      badgeList.push({ cls: 'ok', text: `리스크 지표 정상 범위 (연속손실 P95=${data.longest_loss_streak_95pct}회)` });
    }

    badges.innerHTML = badgeList
      .map(b => `<span class="risk-badge ${b.cls}">${b.text}</span>`)
      .join('');

  } catch (err) {
    // 네트워크 오류 또는 서버 예외 발생 시
    kpiRow.innerHTML = `<p style="font-size:11px; color:var(--red); padding:4px 0;">시뮬레이션 실패: ${err.message}</p>`;
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
