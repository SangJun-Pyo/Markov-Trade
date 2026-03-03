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


// ── 6. AI 채팅 ───────────────────────────────────────────────────

const chatMessages = document.getElementById('chat-messages');

function appendMessage(role, text) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;  // 항상 최신 메시지로 스크롤
  return div;
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';
  appendMessage('user', text);

  const loadingDiv = appendMessage('loading', '분석 중...');

  try {
    const res  = await fetch('/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text }),
    });
    const data = await res.json();

    loadingDiv.className  = 'msg assistant';
    loadingDiv.textContent = data.reply;
  } catch {
    loadingDiv.className  = 'msg assistant';
    loadingDiv.textContent = '⚠️ 서버 오류. 서버가 실행 중인지 확인하세요.';
  }

  await loadJournal();  // 에이전트가 일지를 기록했을 수 있으므로 갱신
}

async function resetChat() {
  await fetch('/reset', { method: 'POST' });
  chatMessages.innerHTML = '';
  appendMessage('assistant', '대화가 초기화되었습니다. 새 분석을 시작하세요.');
}


// ── 7. 매매 일지 ─────────────────────────────────────────────────

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


// ── 8. 이벤트 연결 ──────────────────────────────────────────────

document.getElementById('load-btn').addEventListener('click', loadChart);
document.getElementById('ticker-input').addEventListener('keydown', e => { if (e.key === 'Enter') loadChart(); });
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
document.getElementById('reset-btn').addEventListener('click', resetChat);


// ── 9. 앱 시작 ──────────────────────────────────────────────────

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
    'Markov Trade에 오신 걸 환영합니다 📊\n\n' +
    '왼쪽 패널에서 종목을 선택하거나 직접 입력하세요.\n\n' +
    '예시 요청:\n' +
    '• "현재 BTC 차트 분석해줘"\n' +
    '• "리스크 계산: 자본 500만, 리스크 2%, 진입 95000, 손절 97000, 레버 10x"\n' +
    '• "오늘 매매 기록해줘: BTC 숏 95000 진입, win, +4%"'
  );
})();
