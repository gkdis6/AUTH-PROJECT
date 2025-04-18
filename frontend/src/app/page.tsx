import { redirect } from 'next/navigation';
import Image from "next/image";

export default function HomePage() {
  // 루트 경로 접근 시 무조건 /login으로 리디렉션
  redirect('/login');

  // redirect 이후에는 아무것도 렌더링되지 않지만, 형식상 null 반환
  // return null;
}
