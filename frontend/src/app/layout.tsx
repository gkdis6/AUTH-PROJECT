import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthInitializer from "@/components/AuthInitializer"; // AuthInitializer 임포트

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "인증 프로젝트",
  description: "JWT 기반 인증 시스템",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <AuthInitializer /> { /* AuthInitializer 추가 */}
        {children}
      </body>
    </html>
  );
}
