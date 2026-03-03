"""
dashboard.py — Streamlit 대시보드
실행: streamlit run dashboard.py
"""

import json
from pathlib import Path

import pandas as pd
import streamlit as st

from agent import ChartPlannerAgent
from tools import _load_journal

# ─── 페이지 설정 ──────────────────────────────────────────────────────

st.set_page_config(
    page_title="📊 차트 기획자",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─── 세션 상태 초기화 ─────────────────────────────────────────────────

if "agent" not in st.session_state:
    st.session_state.agent = ChartPlannerAgent()

if "messages" not in st.session_state:
    st.session_state.messages = []

# ─── 사이드바: 매매 통계 ──────────────────────────────────────────────

with st.sidebar:
    st.title("📋 매매 일지")

    journal = _load_journal()
    trades  = journal.get("trades", [])

    if trades:
        wins         = [t for t in trades if t.get("result") == "win"]
        losses       = [t for t in trades if t.get("result") == "loss"]
        open_trades  = [t for t in trades if t.get("result") == "open"]
        total_closed = len(wins) + len(losses)
        win_rate     = (len(wins) / total_closed * 100) if total_closed > 0 else 0

        col1, col2 = st.columns(2)
        col1.metric("총 매매", len(trades))
        col2.metric("승률", f"{win_rate:.1f}%")

        col3, col4 = st.columns(2)
        col3.metric("승", len(wins))
        col4.metric("패", len(losses))

        if open_trades:
            st.info(f"진행 중: {len(open_trades)}건")

        st.divider()
        st.subheader("최근 10건")

        recent = trades[-10:][::-1]  # 최신순
        for t in recent:
            result = t.get("result", "?")
            icon   = {"win": "🟢", "loss": "🔴", "open": "🟡", "breakeven": "⚪"}.get(result, "❓")
            direction_icon = "⬆️" if t.get("direction") == "롱" else "⬇️"
            st.write(
                f"{icon} {direction_icon} **{t.get('ticker', '?')}** "
                f"{t.get('entry', '?')} → {t.get('pnl', '-')}"
            )
    else:
        st.info("기록된 매매가 없습니다.\n에이전트에게 매매를 기록해달라고 요청하세요.")

    st.divider()
    if st.button("🔄 대화 초기화"):
        st.session_state.messages = []
        st.session_state.agent.reset()
        st.rerun()

# ─── 메인: 채팅 UI ────────────────────────────────────────────────────

st.title("📊 주식/선물 차트 기획자 에이전트")
st.caption("개인 전용 — 투자 결정은 본인 책임입니다.")

# 이전 대화 출력
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# 입력창
if prompt := st.chat_input("분석 요청 (예: BTC-USD 현재가 조회해줘)"):
    # 사용자 메시지 표시
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # 에이전트 응답
    with st.chat_message("assistant"):
        with st.spinner("분석 중..."):
            response = st.session_state.agent.chat(prompt)
        st.markdown(response)

    st.session_state.messages.append({"role": "assistant", "content": response})

    # 매매 기록이 바뀌었을 수 있으므로 사이드바 갱신
    st.rerun()

# ─── 일지 전체 보기 (확장 패널) ──────────────────────────────────────

if trades:
    with st.expander("📁 전체 매매 일지 보기"):
        df = pd.DataFrame(trades)
        display_cols = [c for c in ["id", "timestamp", "ticker", "direction",
                                     "entry", "stop_loss", "tp1", "tp2",
                                     "leverage", "result", "pnl", "memo"]
                        if c in df.columns]
        st.dataframe(df[display_cols], use_container_width=True)
