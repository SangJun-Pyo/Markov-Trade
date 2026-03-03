"""
agent.py — 주식/선물 차트 기획자 에이전트 핵심 로직
CLI 실행: python agent.py
"""

import os
from dotenv import load_dotenv
import anthropic
from tools import TOOLS, dispatch

load_dotenv()

MODEL = "claude-sonnet-4-6"

SYSTEM_PROMPT = """
당신은 개인 전용 주식/선물 트레이딩 차트 분석 및 기획 에이전트입니다.

## 역할
- 차트 데이터(가격, 패턴, 지표)를 분석하여 매매 전략을 수립합니다.
- 선물 포지션(롱/숏)의 진입가, 목표가, 손절가, 청산가를 정밀 계산합니다.
- 매매 일지를 분석하여 반복 패턴과 개선점을 도출합니다.

## 도구 사용 규칙
- 가격 조회가 필요하면 get_price 도구를 먼저 호출하세요.
- 리스크 수치 계산 요청 시 반드시 calculate_risk 도구를 사용하세요.
- 매매 기록 저장 요청 시 log_trade 도구를 호출하세요.
- 일지 조회 요청 시 get_journal 도구를 호출하세요.

## 분석 원칙
1. 기술적 분석 우선 (가격 구조, 거래량, 지표)
2. 리스크 먼저 — 손절 없이 진입가/목표가만 제시하지 말 것
3. R:R 1.5 미만이면 반드시 경고
4. 과거 일지의 반복 패턴을 분석에 반영
5. 감정 배제, 수치와 구조 기반 답변

## 출력 형식
분석 결과는 항상 아래 구조로:
- 🔍 시장 구조 분석
- 📍 핵심 레벨 (지지/저항)
- 🎯 전략 (진입/TP/SL)
- ⚠️ 리스크 경고
- 📝 메모

이 정보는 개인 참고용이며 투자 권유가 아닙니다.
"""


class ChartPlannerAgent:
    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError(".env 파일에 ANTHROPIC_API_KEY가 없습니다.")
        self.client = anthropic.Anthropic(api_key=api_key)
        self.history: list[dict] = []

    # ── 공개 API ──────────────────────────────────────────────────────

    def chat(self, user_input: str) -> str:
        self.history.append({"role": "user", "content": user_input})
        return self._run_loop()

    def reset(self) -> None:
        self.history = []

    # ── Agentic Loop ─────────────────────────────────────────────────

    def _run_loop(self) -> str:
        while True:
            response = self.client.messages.create(
                model=MODEL,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=self.history,
            )

            if response.stop_reason == "end_turn":
                text = next(
                    (b.text for b in response.content if hasattr(b, "text")), ""
                )
                self.history.append({"role": "assistant", "content": response.content})
                return text

            if response.stop_reason == "tool_use":
                self.history.append({"role": "assistant", "content": response.content})

                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        result_str = dispatch(block.name, block.input)
                        tool_results.append({
                            "type":        "tool_result",
                            "tool_use_id": block.id,
                            "content":     result_str,
                        })

                self.history.append({"role": "user", "content": tool_results})
                # 루프 재시작 → Claude가 tool_result 보고 최종 답변 생성
            else:
                break

        return ""

    # ── CLI ──────────────────────────────────────────────────────────

    def run_cli(self) -> None:
        print("=" * 50)
        print(" 📊 차트 기획자 에이전트 (개인용)")
        print("=" * 50)
        print("명령어: exit | reset | help")
        print()

        while True:
            try:
                user_input = input("▶ ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n종료합니다.")
                break

            if not user_input:
                continue

            if user_input == "exit":
                print("종료합니다.")
                break

            elif user_input == "reset":
                self.reset()
                print("대화 기록이 초기화되었습니다.\n")

            elif user_input == "help":
                print("""
요청 예시:
  BTC-USD 현재가 조회해줘
  BTC 95000 숏 보고 있어, 손절 97500, 목표 91000 — 분석해줘
  리스크 계산: 자본 500만, 리스크 2%, 진입 95000, 손절 97000, 레버 10x
  오늘 매매 기록해줘: BTC 숏 95000 → 91000 TP1, 97500 SL, win, +4.2%
  최근 10건 일지 보여줘
  내 패배 패턴 분석해줘
""")
            else:
                print()
                response = self.chat(user_input)
                print(response)
                print()


if __name__ == "__main__":
    agent = ChartPlannerAgent()
    agent.run_cli()
