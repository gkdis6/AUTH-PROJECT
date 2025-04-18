'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/stores/auth';
import apiClient from '@/lib/axios';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [apiMessage, setApiMessage] = useState<string>('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const fetchProfile = async () => {
    setApiMessage('프로필 정보 요청 중...');
    try {
      const response = await apiClient.get('/auth/me');
      setProfile(response.data);
      setApiMessage('프로필 정보 가져오기 성공!');
    } catch (error: any) {
      console.error('프로필 정보 가져오기 실패:', error);
      setApiMessage(`프로필 정보 가져오기 실패: ${error.response?.data?.message || error.message}`);
      setProfile(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">로딩 중...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">대시보드</h1>
            </div>
            <div className="flex items-center">
              <span className="mr-4">안녕하세요, {user?.email}</span>
              <button
                onClick={() => logout()}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-4 mb-6">
            <h2 className="text-2xl font-bold mb-4">사용자 정보 (로그인 시 정보)</h2>
            <div className="space-y-4">
              <p>
                <span className="font-semibold">ID:</span> {user?.id}
              </p>
              <p>
                <span className="font-semibold">이메일:</span> {user?.email}
              </p>
              <p>
                <span className="font-semibold">역할:</span> {user?.role}
              </p>
            </div>
          </div>

          <div className="border-4 border-dashed border-gray-200 rounded-lg p-4">
            <h2 className="text-2xl font-bold mb-4">토큰 갱신 테스트</h2>
            <button
              onClick={fetchProfile}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
            >
              프로필 정보 가져오기 (토큰 갱신 테스트)
            </button>
            {apiMessage && (
              <p className="text-sm text-gray-600 mb-4">{apiMessage}</p>
            )}
            {profile && (
              <div>
                <h3 className="text-xl font-semibold mb-2">가져온 프로필 정보:</h3>
                <div className="space-y-2 bg-gray-100 p-3 rounded">
                  <p>
                    <span className="font-semibold">ID:</span> {profile.id}
                  </p>
                  <p>
                    <span className="font-semibold">이메일:</span> {profile.email}
                  </p>
                  <p>
                    <span className="font-semibold">역할:</span> {profile.role}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 