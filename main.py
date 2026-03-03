"""
main.py — Markov Trade FastAPI 서버
실행: uvicorn main:app --reload --port 8000
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# 내가 만든 모듈들을 불러옴
from agent import ChartPlannerAgent           # Claude 에이전트 (Tool Use 포함)
from llm import create_gemini_agent           # Gemini 에이전트 팩토리
from tools import _load_journal, _save_journal, get_ohlcv_for_chart, handle_get_price

# .env에서 API 키 불러오기
load_dotenv()

# ─── FastAPI 앱 생성 ────────────────────────────────────────────────

app = FastAPI(title="Markov Trade", docs_url=None, redoc_url=None)

# 개인 로컬 앱이므로 CORS 전체 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# frontend/ 폴더를 /static 경로로 제공
FRONTEND_DIR = Path(__file__).parent / "frontend"
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


# ─── 에이전트 인스턴스 (서버 시작 시 한 번 생성) ─────────────────────

# Claude 에이전트 — Tool Use(가격 조회, 리스크 계산, 일지 저장 등) 포함
claude_agent = ChartPlannerAgent()

# Gemini 에이전트 — 텍스트 분석 전용, API 키가 없으면 None
# (None이면 Gemini 선택 시 에러 메시지 반환)
gemini_agent = create_gemini_agent()


# ─── 요청/응답 데이터 형태 정의 ──────────────────────────────────────

class ChatRequest(BaseModel):
    """채팅 요청"""
    message:    str                       # 사용자가 입력한 메시지
    model:      str = "gemini"            # 사용할 모델: "claude" 또는 "gemini" (기본값: gemini)
    ticker:     str | None = None         # 현재 화면에 표시된 종목 코드 (예: "BTC-USD")
    chart_data: list[Any] | None = None   # 최근 OHLCV 데이터 배열 (최대 50봉)

class ChatResponse(BaseModel):
    """채팅 응답"""
    reply:  str                   # 에이전트 응답 텍스트
    model:  str                   # 실제로 사용된 모델 이름 (프론트에서 표시용)

class TradeLog(BaseModel):
    """
    매매 기록 저장 요청.
    기존 필드는 그대로 유지하고, 신규 필드는 Optional로 추가해
    기존 데이터(trading_journal.json)와 하위 호환성을 유지한다.
    """
    ticker:     str
    direction:  str
    entry:      float
    stop_loss:  float
    tp1:        float | None = None   # 1차 목표가
    tp2:        float | None = None   # 2차 목표가
    leverage:   int   = 1
    result:     str   = "open"
    pnl:        str   = ""            # 기존 손익 문자열 (예: "+$330")
    memo:       str   = ""
    # ── 신규 확장 필드 (모두 Optional — 기존 레코드에 없어도 오류 없음) ──
    contracts:  int   | None = None   # 계약 수
    fee:        float | None = None   # 수수료 (달러)
    pnl_amount: float | None = None   # 손익 금액 (달러, 숫자형)
    pnl_pct:    float | None = None   # 손익률 (%, 숫자형)
    r_multiple: float | None = None   # R-multiple (예: 1.5 = 리스크의 1.5배 수익)


# ─── 엔드포인트 ──────────────────────────────────────────────────────

@app.get("/")
def serve_index():
    """브라우저 접속 시 index.html 제공"""
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="index.html이 없습니다.")
    return FileResponse(str(index_path))


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """
    사용자 메시지를 선택된 모델에 전달하고 응답을 반환.
    model 파라미터 값에 따라 Claude 또는 Gemini로 분기.
    한 모델이 실패해도 서버가 죽지 않도록 예외 처리.
    """
    model_name = req.model.lower()  # 대소문자 구분 없이 처리

    try:
        if model_name == "claude":
            # Claude — Tool Use 포함 agentic loop 실행
            reply = claude_agent.chat(req.message)

        elif model_name == "gemini":
            # Gemini — 초기화 실패 시 안내 메시지 반환
            if gemini_agent is None:
                reply = (
                    "⚠️ Gemini를 사용할 수 없습니다.\n"
                    ".env 파일에 GEMINI_API_KEY를 추가하고 서버를 재시작하세요.\n"
                    "pip install google-generativeai 도 필요합니다."
                )
            else:
                # 실제 차트 데이터가 있으면 메시지 앞에 컨텍스트로 붙여서 전달
                # — Gemini는 Tool Use가 없으므로 데이터를 텍스트로 직접 제공해야 함
                if req.chart_data and len(req.chart_data) > 0:
                    # OHLCV 데이터를 읽기 쉬운 텍스트로 변환
                    # 각 봉: {time, open, high, low, close} 형식
                    candles_text = "\n".join(
                        f"  {c.get('time', '?')}  "
                        f"시가={c.get('open', '?')}  "
                        f"고가={c.get('high', '?')}  "
                        f"저가={c.get('low', '?')}  "
                        f"종가={c.get('close', '?')}"
                        for c in req.chart_data
                    )
                    ticker_label = req.ticker or "알 수 없는 종목"
                    # 컨텍스트 헤더 + 사용자 원본 메시지를 합쳐서 전달
                    full_message = (
                        f"[현재 차트 데이터 — {ticker_label}, 최근 {len(req.chart_data)}봉]\n"
                        f"{candles_text}\n\n"
                        f"위 실제 데이터를 바탕으로 다음 요청에 답하세요:\n"
                        f"{req.message}"
                    )
                else:
                    # 차트 데이터가 없으면 원본 메시지 그대로 사용
                    full_message = req.message

                reply = gemini_agent.chat(full_message)

        else:
            # 알 수 없는 모델 값이 들어온 경우
            reply = f"⚠️ 알 수 없는 모델: '{req.model}'. 'claude' 또는 'gemini'를 사용하세요."

    except Exception as e:
        # 예상치 못한 오류가 나도 서버가 죽지 않게 처리
        reply = f"⚠️ 오류가 발생했습니다: {str(e)}"
        model_name = req.model

    return ChatResponse(reply=reply, model=model_name)


@app.post("/reset")
def reset_chat(model: str = "all"):
    """
    대화 기록 초기화.
    model 쿼리 파라미터로 특정 모델만 초기화 가능.
    예: /reset?model=claude, /reset?model=gemini, /reset?model=all
    """
    if model in ("claude", "all"):
        claude_agent.reset()

    if model in ("gemini", "all") and gemini_agent:
        gemini_agent.reset()

    return {"status": "ok", "reset": model}


@app.get("/price/{ticker}")
def get_price(ticker: str, period: str = "5d", interval: str = "1h"):
    """현재가 + 기간 내 고/저점 조회"""
    data = handle_get_price({"ticker": ticker, "period": period, "interval": interval})
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])
    return data


@app.get("/price/{ticker}/ohlcv")
def get_ohlcv(ticker: str, period: str = "1mo", interval: str = "1h"):
    """TradingView 차트용 OHLCV 데이터 반환"""
    data = get_ohlcv_for_chart(ticker, period, interval)
    if not data:
        raise HTTPException(status_code=404, detail=f"{ticker} 데이터를 가져올 수 없습니다.")
    return data


@app.get("/journal")
def get_journal():
    """매매 일지 전체 조회"""
    return _load_journal()


@app.post("/journal")
def add_trade(trade: TradeLog):
    """새 매매 기록 추가"""
    journal = _load_journal()
    entry = trade.model_dump()
    entry["id"]        = f"trade_{len(journal['trades']) + 1:04d}"
    entry["timestamp"] = datetime.now().isoformat()
    journal["trades"].append(entry)
    _save_journal(journal)
    return {"status": "저장 완료", "id": entry["id"]}


@app.put("/journal/{trade_id}")
def update_trade(trade_id: str, trade: TradeLog):
    """
    기존 매매 기록 수정.
    프론트에서 Journal 탭의 인라인 편집 또는 Signal→Journal 프리필 연동에 사용.
    None인 필드는 업데이트하지 않고 기존 값을 유지한다.
    """
    journal = _load_journal()
    for i, t in enumerate(journal["trades"]):
        if t.get("id") == trade_id:
            # None이 아닌 필드만 골라서 덮어씀 (기존 값 보호)
            updated = {k: v for k, v in trade.model_dump().items() if v is not None}
            journal["trades"][i].update(updated)
            _save_journal(journal)
            return {"status": "수정 완료", "id": trade_id}
    raise HTTPException(status_code=404, detail=f"{trade_id}를 찾을 수 없습니다.")


@app.delete("/journal/{trade_id}")
def delete_trade(trade_id: str):
    """특정 매매 기록 삭제"""
    journal = _load_journal()
    before  = len(journal["trades"])
    journal["trades"] = [t for t in journal["trades"] if t.get("id") != trade_id]
    if len(journal["trades"]) == before:
        raise HTTPException(status_code=404, detail=f"{trade_id}를 찾을 수 없습니다.")
    _save_journal(journal)
    return {"status": "삭제 완료", "id": trade_id}
