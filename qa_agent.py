"""
qa_agent.py — Markov Trade QA 테스트 에이전트

Claude Agent SDK 기반 QA 시스템:
  - Orchestrator 에이전트가 작업을 분리해 하위 에이전트에 위임
  - backend-qa : FastAPI 엔드포인트 + Python 코드 품질 검사
  - frontend-qa: HTML/CSS/JS 구조 및 일관성 검사
  - logic-qa   : 통계 엔진(RSI/Z-score/Regime/MC) 로직 검증

실행:
    python qa_agent.py            # 전체 QA
    python qa_agent.py --focus backend
    python qa_agent.py --focus frontend
    python qa_agent.py --focus logic
"""

import anyio
import argparse
import sys
from pathlib import Path
from datetime import datetime

from claude_agent_sdk import (
    query,
    ClaudeAgentOptions,
    AgentDefinition,
    ResultMessage,
    SystemMessage,
    AssistantMessage,
    TextBlock,
)

# ── 프로젝트 루트 ────────────────────────────────────────────────────────────
PROJECT_ROOT = str(Path(__file__).parent)


# ── 하위 에이전트 정의 ────────────────────────────────────────────────────────

BACKEND_QA_AGENT = AgentDefinition(
    description=(
        "FastAPI 백엔드 코드의 품질, 엔드포인트 정의, 에러 처리, "
        "Monte Carlo 시뮬레이션 로직을 검사하는 전문 QA 에이전트."
    ),
    prompt="""당신은 Python/FastAPI 전문 QA 엔지니어입니다.

다음 항목을 순서대로 검사하고 각 항목에 PASS / FAIL / WARN 을 명시하세요.

[B1] main.py — API 엔드포인트 검사
  - GET  /          → index.html 반환 여부
  - POST /chat      → ChatRequest 검증, 모델 분기 로직
  - POST /journal   → JournalRequest 저장 로직
  - GET  /journal   → 저널 목록 반환
  - POST /simulate  → Monte Carlo 시뮬레이션 파라미터 및 반환값

[B2] tools.py — 데이터 함수 검사
  - get_ohlcv_for_chart(): yfinance 호출 파라미터
  - handle_get_price():    현재가 응답 구조
  - _load_journal():       파일 없을 때 빈 리스트 반환 여부
  - _save_journal():       JSON 직렬화 안전성

[B3] agent.py — Claude Tool Use 에이전트
  - ChartPlannerAgent 초기화
  - system prompt 내 도구 목록 적절성
  - 에러 핸들링 (API 키 없을 때 등)

[B4] Monte Carlo 로직 (main.py /simulate 엔드포인트)
  - runs 파라미터 범위 검증 (1~10000)
  - Permutation vs Bootstrap 분기
  - risk_of_ruin 계산식 정확성
  - 캐시 키 충돌 가능성

[B5] 보안 / 안전성
  - .env 파일 직접 노출 여부
  - CORS 설정 (*) — 로컬 전용 확인
  - 입력값 검증 누락 항목

결과는 마크다운 표로 정리하고, FAIL/WARN 항목에는 수정 제안을 포함하세요.""",
    tools=["Read", "Glob", "Grep"],
)


FRONTEND_QA_AGENT = AgentDefinition(
    description=(
        "HTML/CSS/JS 프론트엔드 코드의 구조, UI 일관성, "
        "반응형 레이아웃, 접근성을 검사하는 전문 QA 에이전트."
    ),
    prompt="""당신은 프론트엔드 전문 QA 엔지니어입니다.

다음 항목을 순서대로 검사하고 각 항목에 PASS / FAIL / WARN 을 명시하세요.

[F1] index.html — 구조 검사
  - DOCTYPE, viewport meta 태그 존재 여부
  - 필수 요소 id 목록: chart-container, rsi-container, chat-messages,
    chat-input, tf-panel-section, risk-sim-section
  - 롱/숏 버튼, entry-override input 존재 여부
  - 숨기기 버튼: chat-collapse-btn, tf-body-toggle-btn 존재 여부

[F2] style.css — 반응형/배율 검사
  - main-grid minmax() 최솟값 300px 이상 확인
  - DPR 미디어쿼리 (1.25dppx, 1.5dppx) 존재 여부
  - clamp() 사용 — font-size, sidebar-width
  - .chat-collapsed 상태 정의 여부
  - .tf-level-entry/.tf-level-tp/.tf-level-sl 컬러 구분 여부

[F3] app.js — 함수 존재 여부
  필수 함수 목록:
    calcRSI, getRSIBucket, getRSIBucketLabel
    calcRegimeScore, checkEntryFilter
    detectSimpleDivergence, calcExitAdvice
    getConfidenceLabel, getZScoreKeyForRSI
    runMonteCarloSim, renderTFPanel
    loadChart, generateSignal
  각 함수가 정의되어 있는지 확인하세요.

[F4] app.js — RSI 차트 동기화
  - window.rsiChart, window.rsiSeries 전역 변수 존재 여부
  - subscribeVisibleTimeRangeChange 사용 여부 (양방향 동기화)
  - isSyncing 플래그로 무한루프 방지 여부

[F5] app.js — 재조회 시 초기화 로직
  - loadChart() 내에서 entry-override 초기화 여부
  - 롱/숏 버튼 active 클래스 제거 여부

[F6] app.js — 타임프레임 옵션
  - 1분(1m), 3분(3m), 5분(5m) 옵션 존재 여부
  - 기본값이 5d/1h 설정 여부

[F7] BB_LOOKUP_RSI 데이터 무결성
  - mean_reversion / trend 두 레짐 존재 여부
  - 각 레짐에 8개 Z구간 존재 여부
  - 각 Z구간에 5개 RSI bucket 존재 여부
  - 총 80셀 = 2×8×5 확인

결과는 마크다운 표로 정리하고, FAIL/WARN 항목에는 파일:줄번호와 수정 제안을 포함하세요.""",
    tools=["Read", "Glob", "Grep"],
)


LOGIC_QA_AGENT = AgentDefinition(
    description=(
        "거래 전략 통계 로직(RSI 계산, Regime 점수, Entry Filter, "
        "Exit 로직, Monte Carlo)의 수학적 정확성을 검증하는 QA 에이전트."
    ),
    prompt="""당신은 퀀트 트레이딩 전략 로직 전문 QA 엔지니어입니다.

다음 항목을 순서대로 검사하고 각 항목에 PASS / FAIL / WARN 을 명시하세요.

[L1] calcRSI() — Wilder RSI 공식 검증
  - 초기 avgGain/avgLoss: 단순 평균 (SMA 시드)
  - 이후 Wilder smoothing: (prev * (n-1) + curr) / n
  - RSI 공식: 100 - 100/(1+RS), RS=avgGain/avgLoss
  - avgLoss=0 엣지케이스: RSI=100 처리 여부
  - 반환값: { rsiValues: [...], currentRSI: number }

[L2] getRSIBucket() — 경계값 검증
  - rsi=30: 'rsi_0_30'인지 'rsi_30_40'인지 확인
  - rsi=70: 'rsi_60_70'인지 'rsi_70_100'인지 확인
  - (< 기호 사용 시 경계는 상위 bucket에 포함됨)

[L3] calcRegimeScore() — 가중치 합산 검증
  - ADX(40%) + EMA(30%) + RSI편향(30%) = 100%
  - Score > 65 → trend, > 35 → transition, else → range
  - rsiBiasScore = |rsi - 50| * 2 → 범위 [0, 100]
  - atr=0 또는 bandwidth=0 일 때 division by zero 방지

[L4] checkEntryFilter() — 조건 논리 검증
  - 롱: z < -2.2 AND rsi < 30 AND regime === 'range'
  - 숏: z > +2.2 AND rsi > 70 AND regime === 'range'
  - allPass: zOK && rsiOK && regOK (AND 조건)

[L5] detectSimpleDivergence() — 다이버전스 로직 검증
  - 롱 다이버전스: 가격 하락 + RSI 상승 (불리시)
  - 숏 다이버전스: 가격 상승 + RSI 하락 (베어리시)
  - rsiHistory.length < 5 일 때 false 반환 여부

[L6] Monte Carlo Permutation 검증 (main.py)
  - R-multiple 배열에서 복원추출 vs 순열 확인
  - risk_of_ruin: equity < 0인 run 비율
  - worst_5pct_final_R: 하위 5% 백분위수 (sorted[idx])
  - worst_95pct_dd_pct: 상위 95% 백분위수 (sorted[idx])
  - runs=1000 기본값, 최대 10000 상한 검증

[L7] BB_LOOKUP_RSI EV 방향성 검증
  - mean_reversion / z_lt_neg2 (강한 롱 신호):
    rsi_0_30 ev > rsi_70_100 ev 인지 확인 (RSI 필터 방향 맞는지)
  - trend / z_gt_pos2 (강한 숏 신호):
    rsi_70_100 ev > rsi_0_30 ev 인지 확인

결과는 마크다운 표로 정리하고, FAIL 항목에는 코드 예시와 수정 제안을 포함하세요.""",
    tools=["Read", "Glob", "Grep"],
)


# ── Orchestrator 프롬프트 ────────────────────────────────────────────────────

def build_orchestrator_prompt(focus: str) -> str:
    focus_map = {
        "all":      "backend-qa, frontend-qa, logic-qa 에이전트를 모두 실행",
        "backend":  "backend-qa 에이전트만 실행",
        "frontend": "frontend-qa 에이전트만 실행",
        "logic":    "logic-qa 에이전트만 실행",
    }
    instruction = focus_map.get(focus, focus_map["all"])

    return f"""당신은 Markov Trade 프로젝트의 QA Orchestrator입니다.

프로젝트 경로: {PROJECT_ROOT}

지시사항: {instruction}하세요.

각 에이전트 실행 후 결과를 수집하고 다음 형식으로 최종 종합 리포트를 작성하세요:

---
# 🧪 Markov Trade QA 리포트
**날짜**: {datetime.now().strftime('%Y-%m-%d %H:%M')}
**범위**: {focus}

## 요약
| 에이전트 | PASS | FAIL | WARN |
|---------|------|------|------|
(각 에이전트 결과 집계)

## 세부 결과
(각 에이전트 전체 결과 포함)

## 즉시 수정 필요 항목 (FAIL)
(FAIL 항목만 모아서 우선순위별로 나열)

## 개선 권장 항목 (WARN)
(WARN 항목 나열)

## 다음 액션
(우선순위 순서로 수정 제안)
---

에이전트 실행 시 cwd는 "{PROJECT_ROOT}"로 설정되어 있습니다.
각 에이전트가 파일을 읽어 실제 코드를 기반으로 검사하도록 하세요."""


# ── 메인 실행 함수 ────────────────────────────────────────────────────────────

async def run_qa(focus: str = "all") -> str:
    """QA Orchestrator 에이전트 실행 후 최종 리포트 반환"""

    # focus에 따라 에이전트 목록 결정
    agents: dict[str, AgentDefinition] = {}
    if focus in ("all", "backend"):
        agents["backend-qa"] = BACKEND_QA_AGENT
    if focus in ("all", "frontend"):
        agents["frontend-qa"] = FRONTEND_QA_AGENT
    if focus in ("all", "logic"):
        agents["logic-qa"] = LOGIC_QA_AGENT

    print(f"\n🚀 QA 시작 — 범위: {focus}")
    print(f"📂 프로젝트: {PROJECT_ROOT}")
    print(f"🤖 실행 에이전트: {', '.join(agents.keys())}\n")
    print("─" * 60)

    final_report = ""

    async for message in query(
        prompt=build_orchestrator_prompt(focus),
        options=ClaudeAgentOptions(
            cwd=PROJECT_ROOT,
            allowed_tools=["Read", "Glob", "Grep", "Agent"],
            permission_mode="acceptEdits",
            model="claude-opus-4-6",
            max_turns=40,
            agents=agents,
            system_prompt=(
                "당신은 꼼꼼한 QA Orchestrator입니다. "
                "하위 에이전트를 활용해 코드를 철저히 검사하고, "
                "실제 코드를 읽은 근거를 바탕으로 PASS/FAIL/WARN을 판정하세요. "
                "추측으로 판정하지 마세요."
            ),
        ),
    ):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock) and block.text.strip():
                    # 실시간으로 출력
                    print(block.text, end="", flush=True)
                    final_report += block.text

        elif isinstance(message, ResultMessage):
            if message.result and message.result.strip():
                print("\n" + message.result)
                final_report = message.result

    return final_report


# ── 리포트 저장 ───────────────────────────────────────────────────────────────

def save_report(report: str, focus: str) -> Path:
    """QA 리포트를 파일로 저장"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(PROJECT_ROOT) / ".claude"
    output_dir.mkdir(exist_ok=True)

    report_path = output_dir / f"qa_report_{focus}_{timestamp}.md"
    report_path.write_text(report, encoding="utf-8")
    return report_path


# ── CLI 진입점 ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Markov Trade QA 에이전트",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
  python qa_agent.py                  # 전체 QA
  python qa_agent.py --focus backend  # 백엔드만
  python qa_agent.py --focus frontend # 프론트엔드만
  python qa_agent.py --focus logic    # 통계 로직만
  python qa_agent.py --no-save        # 리포트 파일 저장 안 함
        """,
    )
    parser.add_argument(
        "--focus",
        choices=["all", "backend", "frontend", "logic"],
        default="all",
        help="검사 범위 (기본값: all)",
    )
    parser.add_argument(
        "--no-save",
        action="store_true",
        help="리포트 파일 저장 생략",
    )
    args = parser.parse_args()

    # QA 실행
    try:
        report = anyio.run(run_qa, args.focus)
    except KeyboardInterrupt:
        print("\n\n⚠️  QA가 중단되었습니다.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ QA 실행 오류: {e}")
        raise

    # 리포트 저장
    if not args.no_save and report:
        path = save_report(report, args.focus)
        print(f"\n\n✅ 리포트 저장됨: {path}")

    print("\n🏁 QA 완료")


if __name__ == "__main__":
    main()
