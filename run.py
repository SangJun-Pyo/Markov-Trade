"""
Markov Trade 서버 실행 스크립트
- python run.py 또는 start.bat 더블클릭으로 실행
- 서버 시작 후 브라우저 자동으로 열림
"""
import uvicorn
import webbrowser
import threading
import time

def open_browser():
    # 서버가 켜질 시간을 1.5초 기다린 후 브라우저 열기
    time.sleep(1.5)
    webbrowser.open("http://localhost:8000")

if __name__ == "__main__":
    print("\n  Markov Trade 시작 중...")
    print("  주소: http://localhost:8000")
    print("  종료: Ctrl+C\n")

    # 브라우저를 별도 스레드에서 자동으로 열기
    threading.Thread(target=open_browser, daemon=True).start()

    # FastAPI 서버 실행
    uvicorn.run("main:app", port=8000, reload=False)
