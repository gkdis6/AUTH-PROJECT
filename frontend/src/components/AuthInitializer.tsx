'use client';

import { useEffect } from 'react';
import useAuthStore from '@/stores/auth';

export default function AuthInitializer() {
  // 각 상태와 액션을 개별적으로 선택합니다.
  const setLoading = useAuthStore((state) => state.setLoading);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    let didRun = false; // 클로저를 이용해 마운트 시 한 번만 실행되도록 보장

    const initializeAuth = () => {
      if (didRun || isLoading) {
        return;
      }
      didRun = true;

      // HttpOnly 쿠키는 document.cookie로 접근 불가하므로,
      // 쿠키 존재 여부와 관계없이 항상 checkAuth를 시도합니다.
      // 백엔드에서 토큰 유효성을 검증합니다.
      console.log('AuthInitializer: Attempting checkAuth...'); // 로그 추가
      setLoading(true);
      checkAuth(); // checkAuth 내부에서 완료/실패 시 isLoading: false 처리
    };

    initializeAuth();

    // 의존성 배열은 비워두어 마운트 시 한 번만 실행되도록 합니다.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 이 컴포넌트는 UI를 렌더링하지 않습니다.
  return null;
} 