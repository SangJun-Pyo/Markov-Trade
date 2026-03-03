"""
tools.py — Tool Use 핸들러 + yfinance 가격 연동
"""

import json
from datetime import datetime
from pathlib import Path

import yfinance as yf

JOURNAL_FILE = Path(__file__).parent / "trading_journal.json"

# ─── Tool 스키마 정의 ─────────────────────────────────────────────────

TOOLS = [
    {
        "name": "calculate_risk",
        "description": "선물/주식 포지션의 리스크 금액, 포지션 크기, 청산가, R:R 비율을 계산합니다.",
        "input_schema": {
            "type": "object",
            "properties": {
                "capital":    {"type": "number", "description": "총 투자 원금"},
                "risk_pct":   {"type": "number", "description": "허용 리스크 비율 (%, 예: 2)"},
                "entry":      {"type": "number", "description": "진입가"},
                "stop_loss":  {"type": "number", "description": "손절가"},
                "leverage":   {"type": "integer", "description": "레버리지 배수 (기본값: 1)", "default": 1},
                "tp1":        {"type": "number", "description": "1차 목표가 (선택)"},
                "tp2":        {"type": "number", "description": "2차 목표가 (선택)"},
            },
            "required": ["capital", "risk_pct", "entry", "stop_loss"],
        },
    },
    {
        "name": "log_trade",
        "description": "매매 기록을 일지 파일에 저장합니다.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker":    {"type": "string", "description": "종목 (예: BTC-USD, 005930.KS)"},
                "direction": {"type": "string", "enum": ["롱", "숏"], "description": "포지션 방향"},
                "entry":     {"type": "number", "description": "진입가"},
                "stop_loss": {"type": "number", "description": "손절가"},
                "tp1":       {"type": "number", "description": "1차 목표가"},
                "tp2":       {"type": "number", "description": "2차 목표가 (선택)"},
                "leverage":  {"type": "integer", "description": "레버리지 (기본값: 1)", "default": 1},
                "result":    {"type": "string", "enum": ["win", "loss", "breakeven", "open"], "description": "매매 결과"},
                "pnl":       {"type": "string", "description": "손익 (예: +3.5%)"},
                "memo":      {"type": "string", "description": "메모"},
            },
            "required": ["ticker", "direction", "entry", "stop_loss"],
        },
    },
    {
        "name": "get_journal",
        "description": "저장된 매매 일지를 조회하고 통계를 반환합니다.",
        "input_schema": {
            "type": "object",
            "properties": {
                "filter_ticker": {"type": "string", "description": "종목 필터 (선택, 미입력 시 전체)"},
                "filter_result": {
                    "type": "string",
                    "enum": ["win", "loss", "breakeven", "open", "all"],
                    "description": "결과 필터 (기본값: all)",
                },
                "limit": {"type": "integer", "description": "최근 N건 조회 (기본값: 10)"},
            },
        },
    },
    {
        "name": "get_price",
        "description": "yfinance를 통해 종목의 현재가 및 최근 OHLCV 데이터를 가져옵니다.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker":    {"type": "string", "description": "yfinance 종목 코드 (예: BTC-USD, AAPL, 005930.KS)"},
                "period":    {"type": "string", "description": "기간 (1d, 5d, 1mo, 3mo, 기본값: 5d)"},
                "interval":  {"type": "string", "description": "봉 간격 (1m, 5m, 15m, 1h, 1d, 기본값: 1h)"},
            },
            "required": ["ticker"],
        },
    },
]


# ─── 핸들러 ───────────────────────────────────────────────────────────

def handle_calculate_risk(params: dict) -> dict:
    capital   = params["capital"]
    risk_pct  = params["risk_pct"]
    entry     = params["entry"]
    stop_loss = params["stop_loss"]
    leverage  = params.get("leverage", 1)
    tp1       = params.get("tp1")
    tp2       = params.get("tp2")

    risk_amount     = capital * (risk_pct / 100)
    price_diff_pct  = abs(entry - stop_loss) / entry
    position_value  = risk_amount / price_diff_pct if price_diff_pct > 0 else 0

    direction = "롱" if entry > stop_loss else "숏"

    if leverage > 1:
        liquidation = (
            entry * (1 - 1 / leverage) if direction == "롱"
            else entry * (1 + 1 / leverage)
        )
    else:
        liquidation = None

    result = {
        "방향":        direction,
        "리스크 금액":  f"{risk_amount:,.0f}",
        "손절 거리":    f"{price_diff_pct * 100:.2f}%",
        "포지션 가치":  f"{position_value:,.0f}",
        "레버리지":     f"{leverage}x",
        "청산가":       f"{liquidation:,.4f}" if liquidation else "없음",
    }

    for label, tp in [("TP1", tp1), ("TP2", tp2)]:
        if tp:
            tp_pct = abs(tp - entry) / entry
            rr = tp_pct / price_diff_pct if price_diff_pct > 0 else 0
            result[f"{label} 수익률"] = f"{tp_pct * 100:.2f}%"
            result[f"R:R ({label})"]  = f"1:{rr:.2f}"
            if label == "TP1" and rr < 1.5:
                result["⚠️ 경고"] = "R:R이 1.5 미만 — 진입 재검토 권장"

    return result


def handle_log_trade(params: dict) -> dict:
    journal = _load_journal()
    params["timestamp"] = datetime.now().isoformat()
    params["id"] = f"trade_{len(journal['trades']) + 1:04d}"
    journal["trades"].append(params)
    _save_journal(journal)
    return {"status": "저장 완료", "trade_id": params["id"]}


def handle_get_journal(params: dict) -> dict:
    journal = _load_journal()
    trades  = journal.get("trades", [])

    ticker_filter = params.get("filter_ticker")
    result_filter = params.get("filter_result", "all")
    limit         = params.get("limit", 10)

    if ticker_filter:
        trades = [t for t in trades if t.get("ticker") == ticker_filter]
    if result_filter != "all":
        trades = [t for t in trades if t.get("result") == result_filter]

    wins   = [t for t in trades if t.get("result") == "win"]
    losses = [t for t in trades if t.get("result") == "loss"]
    total_closed = len(wins) + len(losses)
    win_rate = (len(wins) / total_closed * 100) if total_closed > 0 else 0

    return {
        "총 매매": len(trades),
        "승":      len(wins),
        "패":      len(losses),
        "승률":    f"{win_rate:.1f}%",
        "최근 기록": trades[-limit:],
    }


def handle_get_price(params: dict) -> dict:
    ticker   = params["ticker"]
    period   = params.get("period", "5d")
    interval = params.get("interval", "1h")

    try:
        tk   = yf.Ticker(ticker)
        hist = tk.history(period=period, interval=interval)

        if hist.empty:
            return {"error": f"{ticker} 데이터 없음. 종목 코드 확인 필요."}

        last  = hist.iloc[-1]
        highs = hist["High"].tolist()
        lows  = hist["Low"].tolist()

        return {
            "ticker":    ticker,
            "현재가":    round(float(last["Close"]), 4),
            "시가":      round(float(last["Open"]), 4),
            "고가":      round(float(last["High"]), 4),
            "저가":      round(float(last["Low"]), 4),
            "거래량":    int(last["Volume"]),
            "기간 고점": round(max(highs), 4),
            "기간 저점": round(min(lows), 4),
            "봉 수":     len(hist),
            "마지막 시간": str(hist.index[-1]),
        }
    except Exception as e:
        return {"error": str(e)}


# ─── 라우터 ───────────────────────────────────────────────────────────

TOOL_HANDLERS = {
    "calculate_risk": handle_calculate_risk,
    "log_trade":      handle_log_trade,
    "get_journal":    handle_get_journal,
    "get_price":      handle_get_price,
}


def dispatch(tool_name: str, tool_input: dict) -> str:
    handler = TOOL_HANDLERS.get(tool_name)
    if not handler:
        result = {"error": f"알 수 없는 도구: {tool_name}"}
    else:
        try:
            result = handler(tool_input)
        except Exception as e:
            result = {"error": str(e)}
    return json.dumps(result, ensure_ascii=False)


# ─── TradingView 차트용 OHLCV 변환 ───────────────────────────────────

def get_ohlcv_for_chart(ticker: str, period: str = "1mo", interval: str = "1h") -> list:
    """
    yfinance에서 받은 데이터를 TradingView Lightweight Charts 형식으로 변환해서 돌려줌.
    TradingView는 { time: 초단위_타임스탬프, open, high, low, close } 형태를 요구함.
    """
    try:
        tk   = yf.Ticker(ticker)                          # yfinance로 종목 객체 생성
        hist = tk.history(period=period, interval=interval)  # 기간·봉 단위로 OHLCV 요청

        if hist.empty:
            return []  # 데이터가 없으면 빈 리스트 반환

        result = []
        for ts, row in hist.iterrows():
            # pandas Timestamp를 Unix 초 단위 정수로 변환 (TradingView가 이 형식 요구)
            unix_time = int(ts.timestamp())
            result.append({
                "time":  unix_time,
                "open":  round(float(row["Open"]),  4),
                "high":  round(float(row["High"]),  4),
                "low":   round(float(row["Low"]),   4),
                "close": round(float(row["Close"]), 4),
            })

        return result

    except Exception:
        return []  # 오류 발생 시 빈 리스트 반환 (프론트가 빈 차트로 처리)


# ─── 저널 유틸 ────────────────────────────────────────────────────────

def _load_journal() -> dict:
    if JOURNAL_FILE.exists():
        with open(JOURNAL_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"trades": []}


def _save_journal(journal: dict) -> None:
    with open(JOURNAL_FILE, "w", encoding="utf-8") as f:
        json.dump(journal, f, ensure_ascii=False, indent=2)
