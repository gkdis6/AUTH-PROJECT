import 'axios';

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retry?: boolean; // _retry 속성을 optional로 추가
  }
} 