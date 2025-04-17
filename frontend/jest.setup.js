// Jest 전역 설정
global.console = {
  ...console,
  // 테스트 중에 불필요한 로그를 숨김
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}; 