# 인증 프로젝트 예제 (NestJS + Next.js)

이 프로젝트는 NestJS(백엔드)와 Next.js(프론트엔드)를 사용하여 JWT 기반 인증 시스템을 구현한 예제입니다. Access Token과 Refresh Token을 `httpOnly` 쿠키를 통해 안전하게 관리하는 방식을 사용합니다.

## 주요 기술 스택

*   **백엔드 (Backend)**:
    *   NestJS (Node.js 프레임워크)
    *   TypeScript
    *   TypeORM (ORM)
    *   PostgreSQL (데이터베이스)
    *   Passport.js (인증 전략)
    *   `bcrypt` (비밀번호 해싱)
    *   `cookie-parser` (쿠키 파싱)
*   **프론트엔드 (Frontend)**:
    *   Next.js (React 프레임워크)
    *   TypeScript
    *   Axios (HTTP 클라이언트)
    *   Tailwind CSS (스타일링)

## 인증 로직 개요

이 시스템은 **Access Token**과 **Refresh Token**을 활용한 JWT 인증 방식을 따릅니다. 보안 강화를 위해 두 토큰은 모두 **`httpOnly` 쿠키**에 저장되어 자바스크립트를 통한 직접적인 접근(XSS 공격)을 방지합니다.

*   **Access Token**:
    *   수명이 짧으며 (예: 15분), 실제 API 요청 시 쿠키를 통해 서버에 전달되어 사용자를 인증합니다.
    *   `httpOnly`, `path=/` 속성을 가진 쿠키로 저장됩니다. `path=/` 설정은 애플리케이션의 모든 경로에서 API를 요청할 때 브라우저가 자동으로 Access Token 쿠키를 포함하도록 보장합니다.
*   **Refresh Token**:
    *   수명이 길며 (예: 7일), Access Token이 만료되었을 때 새로운 Access Token을 발급받는 데 사용됩니다.
    *   백엔드 데이터베이스에도 해시된 값이 저장되어, 서버 측에서 특정 사용자의 리프레시 토큰을 무효화하는 등 보안을 강화합니다.
    *   `httpOnly`, `path=/` 속성을 가진 쿠키로 저장됩니다.
        *   **`path=/` 설정**: Access Token과 동일하게 `path=/`로 설정하여, `/auth/refresh` 엔드포인트 요청 시뿐만 아니라 다른 API 요청 시에도 브라우저가 Refresh Token 쿠키를 함께 전송하도록 합니다. 이는 백엔드에서 요청 헤더 크기를 약간 증가시킬 수 있지만, 쿠키 관리의 복잡성을 줄이고 프론트엔드 구현을 단순화하는 데 도움이 될 수 있습니다. 백엔드의 `/auth/refresh` 엔드포인트는 요청에 포함된 Refresh Token만 사용하여 갱신 로직을 처리합니다.

**주요 흐름:**

1.  **로그인**: 사용자가 유효한 자격 증명으로 로그인하면, 백엔드는 Access Token과 Refresh Token을 생성하여 `httpOnly`, `path=/` 속성을 가진 쿠키로 설정하고, Refresh Token의 해시를 DB에 저장합니다.
2.  **API 요청**: 프론트엔드는 API 요청 시 `withCredentials: true` 옵션을 사용하여 쿠키를 자동으로 포함시킵니다. 백엔드는 주로 Access Token을 검증합니다.
3.  **토큰 재발급**: Access Token이 만료되어 API 요청이 401 에러(`errorCode: 'ACCESS_TOKEN_EXPIRED'`)를 반환하면, 프론트엔드의 Axios 인터셉터가 이를 감지합니다. 인터셉터는 자동으로 `/auth/refresh` 엔드포인트로 요청을 보내고, 이때 Refresh Token 쿠키(`path=/`)가 함께 전송됩니다. 백엔드는 Refresh Token을 검증하고 유효하면 새로운 Access Token(`path=/`)을 발급하여 쿠키로 설정합니다. 인터셉터는 원래 실패했던 요청을 새로운 Access Token으로 재시도합니다.
4.  **로그아웃**: 사용자가 로그아웃하면, 백엔드는 DB의 Refresh Token 해시를 제거하고, 클라이언트의 Access Token 및 Refresh Token 쿠키(`path=/`)를 만료시킵니다.

## 프로젝트 구조 (간략) 
```
.
├── backend/ # NestJS 백엔드
│ ├── src/
│ │ ├── auth/ # 인증 관련 모듈 (Controller, Service, Strategies, DTOs, Interfaces)
│ │ ├── user/ # 사용자 관련 모듈 (Controller, Service, Entity, DTOs, Enums)
│ │ ├── app.module.ts
│ │ └── main.ts # 애플리케이션 진입점
│ ├── .env # 환경 변수 (직접 생성 필요)
│ └── ...
├── frontend/ # Next.js 프론트엔드
│ ├── src/
│ │ ├── app/ # 라우팅 및 페이지 (App Router)
│ │ │ ├── (auth)/ # 인증 관련 레이아웃/페이지 (예: login, signup)
│ │ │ ├── (main)/ # 로그인 후 보여질 레이아웃/페이지 (예: dashboard)
│ │ │ └── layout.tsx
│ │ ├── components/ # 공통 컴포넌트
│ │ ├── context/ # 전역 상태 관리 (예: AuthContext)
│ │ ├── hooks/ # 커스텀 훅
│ │ └── lib/ # 라이브러리, 유틸리티 (예: axios 인스턴스)
│ ├── .env.local # 환경 변수 (직접 생성 필요)
│ └── ...
├── .gitignore
└── README.md # 현재 파일
```

## 설치 및 실행

**사전 요구 사항:**

*   Node.js (v18 이상 권장)
*   npm 또는 yarn
*   PostgreSQL 데이터베이스 (또는 Docker 사용)

**1. 백엔드 설정 및 실행:**

```bash
# 1. 백엔드 디렉토리 이동
cd backend

# 2. 환경 변수 파일 생성 (.env.example 복사 또는 직접 생성)
# cp .env.example .env
# nano .env # 아래 환경 변수 내용 참고하여 값 입력

# 3. 의존성 설치
npm install
# 또는 yarn install

# 4. 데이터베이스 설정
#    - PostgreSQL 서버 실행 확인
#    - .env 파일에 DATABASE_URL 등 연결 정보 입력
#    - TypeORM 마이그레이션 실행 또는 synchronize:true (개발용) 활성화

# 5. 백엔드 개발 서버 실행
npm run start:dev
# 또는 yarn start:dev
# (http://localhost:3000 에서 실행 확인)
```

**2. 프론트엔드 설정 및 실행:**

```bash
# 1. 프론트엔드 디렉토리 이동 (루트에서)
cd frontend

# 2. 환경 변수 파일 생성 (.env.local.example 복사 또는 직접 생성)
# cp .env.local.example .env.local
# nano .env.local # NEXT_PUBLIC_API_URL 값 입력 (예: http://localhost:3000)

# 3. 의존성 설치
npm install
# 또는 yarn install

# 4. 프론트엔드 개발 서버 실행
npm run dev
# 또는 yarn dev
# (http://localhost:3001 에서 실행 확인)
```

**3. 애플리케이션 접속:**

*   브라우저에서 `http://localhost:3001` 로 접속합니다.
*   회원가입 및 로그인을 진행합니다.

## 환경 변수

**백엔드 (`backend/.env`)**:

```text
# 데이터베이스 연결 정보 (TypeORM)
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE_NAME

# JWT 설정
JWT_SECRET=your_strong_jwt_secret_key # Access Token 서명 키
JWT_EXPIRATION_TIME=15m               # Access Token 만료 시간 (예: 15분)
JWT_EXPIRATION_TIME_MS=900000         # Access Token 만료 시간 (밀리초)

JWT_REFRESH_SECRET=your_strong_jwt_refresh_secret_key # Refresh Token 서명 키
JWT_REFRESH_EXPIRATION_TIME=7d        # Refresh Token 만료 시간 (예: 7일)
JWT_REFRESH_EXPIRATION_TIME_MS=604800000 # Refresh Token 만료 시간 (밀리초)

# 기타
NODE_ENV=development # 'development' 또는 'production' (쿠키 secure 속성 등에 영향)
PORT=3000            # 백엔드 서버 포트
```

**프론트엔드 (`frontend/.env.local`)**:

```text
NEXT_PUBLIC_API_URL=http://localhost:3000 # 백엔드 API 서버 주소
```

## 주요 기능

*   JWT 기반 인증 (Access Token, Refresh Token)
*   `httpOnly` 쿠키를 사용한 안전한 토큰 저장
*   비밀번호 암호화 (bcrypt)
*   자동 토큰 재발급 (Axios 인터셉터 사용)
*   요청/응답 데이터 유효성 검사 (class-validator, class-transformer)
*   역할 기반 접근 제어 (기본 구조 포함)

## 데이터베이스 테이블 구조

### User 테이블

| 컬럼명                      | 데이터 타입        | 제약 조건                     | 설명                        |
| :-------------------------- | :----------------- | :---------------------------- | :-------------------------- |
| `id`                        | UUID               | PRIMARY KEY                   | 사용자 고유 ID (UUID)       |
| `username`                  | VARCHAR            | NOT NULL, UNIQUE              | 사용자 이름                 |
| `email`                     | VARCHAR            | NOT NULL, UNIQUE              | 이메일 주소                 |
| `password_hash`             | VARCHAR            | NOT NULL                      | 해시된 비밀번호             |
| `role`                      | ENUM('USER', 'ADMIN') | NOT NULL, DEFAULT 'USER'      | 사용자 역할                 |
| `createdAt`                 | TIMESTAMP          | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 생성 일시                   |
| `updatedAt`                 | TIMESTAMP          | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 수정 일시                   |
| `currentHashedRefreshToken` | VARCHAR            | NULL                          | 현재 해시된 리프레시 토큰 |

## 테스트 케이스 (백엔드 - AuthController)

`backend/src/auth/auth.controller.spec.ts` 파일은 `AuthController`의 주요 기능과 시나리오를 검증합니다. 각 테스트 케이스의 목적은 다음과 같습니다.

*   **컨트롤러 정의:**
    *   `it('컨트롤러가 정의되어 있어야 함')`: 의존성 주입을 포함하여 `AuthController` 인스턴스가 성공적으로 생성되는지 기본적인 'smoke test'를 수행합니다.

*   **회원가입 (signUp):**
    *   `it('성공: 새로운 사용자를 생성하고 민감 정보를 제외한 정보를 반환해야 함')`: 회원가입 요청 시 `AuthService.signUp`이 올바른 데이터로 호출되고, 응답 객체의 `json` 메소드가 민감 정보(비밀번호 해시 등)가 제외된 사용자 정보와 함께 호출되는지 확인합니다.
    *   `it('실패: 이메일 중복 등으로 서비스에서 ConflictException 발생 시 예외를 전파해야 함')`: `AuthService.signUp`에서 이메일 중복 등의 이유로 `ConflictException`이 발생했을 때, 해당 예외가 컨트롤러를 통해 올바르게 전파되는지 확인합니다.

*   **로그인 (signIn):**
    *   `it('성공: 사용자 정보를 반환하고 AuthService가 쿠키를 설정해야 함')`: 로그인 요청 시 `AuthService.signIn`이 올바른 자격 증명 및 `Response` 객체와 함께 호출되고, 컨트롤러가 성공 메시지와 사용자 정보(`AuthenticatedUser` 타입)를 반환하는지 확인합니다. (실제 쿠키 설정은 모의 `AuthService`에서 처리됨을 가정)
    *   `it('실패: 잘못된 자격 증명으로 서비스에서 UnauthorizedException 발생 시 예외를 전파해야 함')`: `AuthService.signIn`에서 잘못된 이메일/비밀번호로 인해 `UnauthorizedException`이 발생했을 때, 해당 예외가 컨트롤러를 통해 올바르게 전파되는지 확인합니다.

*   **토큰 갱신 (refreshTokens):**
    *   `it('성공: AuthService.refreshTokens를 호출하고 성공 메시지를 반환해야 함')`: 유효한 리프레시 토큰 요청 (`@UseGuards(AuthGuard('jwt-refresh'))` 통과 가정) 시, `AuthService.refreshTokens`가 올바른 `userId`, `refreshToken` (from `req.user`), `Response` 객체와 함께 호출되고, 컨트롤러가 성공 메시지를 반환하는지 확인합니다. (새 토큰 쿠키 설정은 모의 `AuthService` 책임)
    *   `it('실패: 유효하지 않은 리프레시 토큰으로 서비스에서 UnauthorizedException 발생 시 예외를 전파해야 함')`: `AuthService.refreshTokens`에서 만료되거나 유효하지 않은 리프레시 토큰으로 인해 `UnauthorizedException`이 발생했을 때, 해당 예외가 컨트롤러를 통해 올바르게 전파되는지 확인합니다.

*   **로그아웃 (logout):**
    *   `it('성공: AuthService.logout을 호출하고 성공 메시지를 반환해야 함')`: 로그아웃 요청 (`@UseGuards(JwtAuthGuard)` 통과 가정) 시 `AuthService.logout`이 올바른 `userId` (from `req.user`)와 `Response` 객체와 함께 호출되고, 컨트롤러가 성공 메시지를 반환하는지 확인합니다. (쿠키 제거는 모의 `AuthService` 책임)

*   **프로필 조회 (getProfile):**
    *   `it('성공: 인증된 사용자의 프로필 정보를 반환해야 함')`: 유효한 액세스 토큰으로 보호된 `/auth/me` 요청 (`@UseGuards(JwtAuthGuard)` 통과 가정) 시, `req` 객체에 포함된 사용자 정보(`req.user`)가 컨트롤러에서 그대로 반환되는지 확인합니다.

*   **토큰 만료 및 갱신 프로세스 (흐름 검증):**
    *   `it('성공: 액세스 토큰 만료 -> 리프레시 -> 프로필 재요청 성공 흐름')`: ①로그인 후 ②액세스 토큰이 만료되었다고 가정하고 ③`/auth/refresh` 엔드포인트를 호출하여 토큰 갱신을 시뮬레이션(모의 `AuthService.refreshTokens`에서 새 쿠키 설정)한 뒤 ④새 토큰으로 `/auth/me` 요청이 성공하는(올바른 사용자 정보 반환) 전체적인 흐름을 검증합니다.
    *   `it('실패: 리프레시 토큰 만료 시 토큰 갱신 실패')`: 리프레시 토큰 자체도 만료되었거나 유효하지 않을 때, `/auth/refresh` 엔드포인트 호출 시 `AuthService`에서 `UnauthorizedException`이 발생하고 이것이 컨트롤러를 통해 전파되는지 확인합니다.
