'use client';

import { useEffect } from 'react';
import useAuthStore from '@/stores/auth';

export default function AuthInitializer() {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    // document.cookie에서 'accessToken' 쿠키 확인
    const cookies = document.cookie.split(';').map(cookie => cookie.trim());
    const accessTokenExists = cookies.some(cookie => cookie.startsWith('accessToken='));

    if (accessTokenExists) {
      checkAuth();
    }
  }, [checkAuth]);

  // 이 컴포넌트는 UI를 렌더링하지 않습니다.
  return null;
} 