"""
llm.py — LLM 분기 처리 모듈
Claude와 Gemini 에이전트를 통합 관리.
main.py에서 model 파라미터 값에 따라 여기서 분기함.
"""

import os

# ─── 공통 시스템 프롬프트 ────────────────────────────────────────────
# Claude와 Gemini 모두 같은 프롬프트를 써서 응답 형식을 통일함

SYSTEM_PROMPT = """
당신은 개인 전용 주식/선물 트레이딩 차트 분석 및 기획 에이전트입니다.

## 역할
- 차트 데이터(가격, 패턴, 지표)를 분석하여 매매 전략을 수립합니다.
- 선물 포지션(롱/숏)의 진입가, 목표가, 손절가, 청산가를 정밀 계산합니다.
- 매매 일지를 분석하여 반복 패턴과 개선점을 도출합니다.

## 분석 원칙
1. 기술적 분석 우선 (가격 구조, 거래량, 지표)
2. 리스크 먼저 — 손절 없이 진입가/목표가만 제시하지 말 것
3. R:R 1.5 미만이면 반드시 경고
4. 감정 배제, 수치와 구조 기반 답변

## 출력 형식
분석 결과는 항상 아래 구조로:
- 🔍 시장 구조 분석
- 📍 핵심 레벨 (지지/저항)
- 🎯 전략 (진입/TP/SL)
- ⚠️ 리스크 경고
- 📝 메모

이 정보는 개인 참고용이며 투자 권유가 아닙니다.
"""


# ─── Gemini 에이전트 ─────────────────────────────────────────────────

class GeminiAgent:
    """
    Google Gemini API를 이용한 트레이딩 분석 에이전트.
    Claude와 동일한 시스템 프롬프트를 사용해 응답 형식을 통일함.
    (Tool Use 미지원 — 텍스트 분석만 수행)
    """

    def __init__(self):
        # google-generativeai 패키지가 설치되어 있는지 먼저 확인
        try:
            import google.generativeai as genai
            self._genai = genai
        except ImportError:
            raise RuntimeError(
                "google-generativeai 패키지가 없습니다.\n"
                "터미널에서: pip install google-generativeai"
            )

        # .env에서 Gemini API 키 불러오기 (절대 코드에 직접 쓰지 않음)
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError(
                ".env 파일에 GEMINI_API_KEY가 없습니다.\n"
                "GEMINI_API_KEY=your_key_here 형식으로 추가하세요."
            )

        # Gemini API 키 설정
        genai.configure(api_key=api_key)
        self._init_session()

    def _init_session(self):
        """
        채팅 세션을 초기화하는 내부 함수.
        처음 시작할 때와 reset() 호출 시 모두 사용.
        """
        # gemini-1.5-flash: 빠르고 무료 할당량이 넉넉한 모델
        model = self._genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=SYSTEM_PROMPT,  # 시스템 프롬프트로 역할 부여
        )
        # 대화 히스토리를 기억하는 채팅 세션 시작
        self.session = model.start_chat(history=[])

    def chat(self, user_input: str) -> str:
        """사용자 메시지를 Gemini에 보내고 응답 텍스트를 반환"""
        try:
            response = self.session.send_message(user_input)
            return response.text
        except Exception as e:
            # Gemini 오류가 나도 서버 전체가 죽지 않도록 예외 처리
            return f"⚠️ Gemini 오류: {str(e)}"

    def reset(self):
        """대화 기록 초기화 — 새 분석 시작 시 사용"""
        self._init_session()


# ─── 에이전트 팩토리 함수 ─────────────────────────────────────────────

def create_gemini_agent() -> GeminiAgent | None:
    """
    Gemini 에이전트를 안전하게 생성.
    API 키가 없거나 패키지가 없으면 None을 반환 (서버가 죽지 않게).
    """
    try:
        return GeminiAgent()
    except Exception as e:
        # 서버 시작 시 오류 메시지를 출력하지만 서버는 계속 실행
        print(f"[llm.py] Gemini 에이전트 초기화 실패 (Claude만 사용 가능): {e}")
        return None
