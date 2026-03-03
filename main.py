"""
main.py — FastAPI 웹 서버
실행: uvicorn main:app --reload --port 8000
브라우저: http://localhost:8000
"""

import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# 내가 만든 에이전트와 도구 파일을 불러옴
from agent import ChartPlannerAgent
from tools import _load_journal, _save_journal, get_ohlcv_for_chart, handle_get_price

# .env 파일에서 API 키 불러오기
load_dotenv()

# ─── FastAPI 앱 생성 ────────────────────────────────────────────────

app = FastAPI(title="차트 기획자", docs_url=None, redoc_url=None)

# 브라우저에서 API를 자유롭게 호출할 수 있도록 CORS 허용 (개인 로컬용이라 전체 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# frontend/ 폴더를 /static 경로로 제공 (CSS, JS 파일을 브라우저가 받아갈 수 있게)
FRONTEND_DIR = Path(__file__).parent / "frontend"
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

# ─── 에이전트 인스턴스 ────────────────────────────────────────────────
# 서버가 켜지면 에이전트를 한 번만 만들어서 계속 사용 (개인용이라 1개면 충분)
agent = ChartPlannerAgent()


# ─── 요청/응답 데이터 형태 정의 (Pydantic) ────────────────────────────

class ChatRequest(BaseModel):
    """채팅 요청: 사용자가 입력한 메시지"""
    message: str

class ChatResponse(BaseModel):
    """채팅 응답: 에이전트가 돌려주는 메시지"""
    reply: str

class TradeLog(BaseModel):
    """매매 기록 저장 요청 형태"""
    ticker:    str            # 종목 (예: BTC-USD)
    direction: str            # 방향: "롱" 또는 "숏"
    entry:     float          # 진입가
    stop_loss: float          # 손절가
    tp1:       float | None = None  # 1차 목표가 (선택)
    tp2:       float | None = None  # 2차 목표가 (선택)
    leverage:  int   = 1      # 레버리지 배수
    result:    str   = "open" # 결과: win / loss / breakeven / open
    pnl:       str   = ""     # 손익 (예: +3.5%)
    memo:      str   = ""     # 메모


# ─── 라우터 (엔드포인트) 정의 ─────────────────────────────────────────

@app.get("/")
def serve_index():
    """브라우저에서 주소를 치면 index.html을 돌려줌"""
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="index.html이 없습니다.")
    return FileResponse(str(index_path))


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """
    사용자 메시지를 에이전트에 전달하고 분석 결과를 받아서 돌려줌.
    에이전트가 필요하면 yfinance 조회, 리스크 계산 등의 도구를 자동으로 사용함.
    """
    reply = agent.chat(req.message)
    return ChatResponse(reply=reply)


@app.post("/reset")
def reset_chat():
    """대화 기록을 초기화 — 새 주제로 분석 시작할 때 사용"""
    agent.reset()
    return {"status": "ok", "message": "대화 기록이 초기화되었습니다."}


@app.get("/price/{ticker}")
def get_price(ticker: str, period: str = "5d", interval: str = "1h"):
    """
    종목의 현재가와 기간 내 고/저점을 조회.
    예: /price/BTC-USD?period=5d&interval=1h
    """
    data = handle_get_price({"ticker": ticker, "period": period, "interval": interval})
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])
    return data


@app.get("/price/{ticker}/ohlcv")
def get_ohlcv(ticker: str, period: str = "1mo", interval: str = "1h"):
    """
    TradingView 차트에 바로 꽂을 수 있는 OHLCV 데이터 반환.
    예: /price/BTC-USD/ohlcv?period=1mo&interval=1h
    반환 형식: [{ time, open, high, low, close }, ...]
    """
    data = get_ohlcv_for_chart(ticker, period, interval)
    if not data:
        raise HTTPException(status_code=404, detail=f"{ticker} 데이터를 가져올 수 없습니다.")
    return data


@app.get("/journal")
def get_journal():
    """저장된 매매 일지 전체를 반환"""
    return _load_journal()


@app.post("/journal")
def add_trade(trade: TradeLog):
    """새 매매 기록을 일지에 추가"""
    journal = _load_journal()

    # 새 기록에 ID와 기록 시간 자동 부여
    entry = trade.model_dump()
    entry["id"]        = f"trade_{len(journal['trades']) + 1:04d}"
    entry["timestamp"] = datetime.now().isoformat()

    journal["trades"].append(entry)
    _save_journal(journal)
    return {"status": "저장 완료", "id": entry["id"]}


@app.delete("/journal/{trade_id}")
def delete_trade(trade_id: str):
    """특정 ID의 매매 기록을 삭제"""
    journal = _load_journal()
    before  = len(journal["trades"])

    # 해당 ID가 아닌 것만 남김 (= 해당 ID 삭제)
    journal["trades"] = [t for t in journal["trades"] if t.get("id") != trade_id]

    if len(journal["trades"]) == before:
        raise HTTPException(status_code=404, detail=f"{trade_id}를 찾을 수 없습니다.")

    _save_journal(journal)
    return {"status": "삭제 완료", "id": trade_id}
