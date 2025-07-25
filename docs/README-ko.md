# Messenger

WebSocket을 지원하는 실시간 채팅 애플리케이션으로, 현대적인 UI와 국제화 기능을 제공합니다.

## 기능

- Socket.io를 사용한 실시간 메시징
- 파일 및 이미지 업로드 기능
- 푸시 알림 지원
- 다국어 인터페이스
- 사쿠라 애니메이션 효과를 포함한 반응형 디자인
- SQLite 데이터베이스 통합

## 설치

### 필수 조건
- Node.js (v14 이상)
- npm (v6 이상)

### 단계
1. 저장소 클론
   ```bash
   git clone https://github.com/quiettimejsg/messenger.git
   cd messenger
   ```

2. 의존성 설치
   ```bash
   npm install
   ```

3. 구성을 위한 `.env` 파일 생성 (선택 사항):
   ```
   PORT=3000
   ```

## 사용 방법

### 서버 시작

```bash
# npm 사용
npm start

# Windows 배치 파일 사용
start.bat
```

### 애플리케이션 접근
브라우저를 열고 `http://localhost:3000`으로 이동하세요

## 구성
- **푸시 알림**: 애플리케이션 설정에서 푸시 알림 URL을 추가하세요
- **언어**: 앱은 언어 기본 설정을 자동으로 감지하며, 설정에서 수동으로 변경할 수 있습니다

## 라이선스
AGPL-3.0 라이선스

## 사용된 기술
- [Express](https://expressjs.com/) - 웹 프레임워크
- [Socket.io](https://socket.io/) - 실시간 통신
- [SQLite3](https://www.sqlite.org/) - 데이터베이스
- [Sharp](https://sharp.pixelplumbing.com/) - 이미지 처리