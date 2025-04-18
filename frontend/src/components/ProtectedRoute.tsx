'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/stores/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    // 로딩이 완료되었고, 인증되지 않았다면 로그인 페이지로 리디렉션
    // isLoading 상태가 명확히 false가 된 후에만 리디렉션 수행
    if (!isLoading && !isAuthenticated) {
      console.log('ProtectedRoute: Not authenticated, redirecting to /login');
    //   router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // 로딩 중일 경우 로딩 표시
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">인증 확인 중...</div>
      </div>
    );
  }

  // 인증되었거나, 아직 리디렉션이 실행되기 전에는 children을 렌더링
  // (리디렉션은 useEffect에서 비동기적으로 발생)
  // 인증되지 않은 상태에서 잠시 children이 렌더링될 수 있으나,
  // 실제 데이터 로딩 등은 children 내부에서 처리될 것이므로 큰 문제는 아님.
  // 또는, !isAuthenticated 일 때 null을 반환하도록 수정 가능.
  if (!isAuthenticated) {
    // 리디렉션 될 때까지 아무것도 보여주지 않음
    return null;
  }

  // 최종적으로 인증된 경우 children 렌더링
  return <>{children}</>;
} 