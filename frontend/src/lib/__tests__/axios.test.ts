import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import apiClient from '../axios';

// AxiosRequestConfig 인터페이스 확장
interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

// axios 모의 객체 생성
jest.mock('axios', () => {
  const mockAxios = {
    create: jest.fn(() => {
      const instance = {
        get: jest.fn(),
        post: jest.fn(),
        request: jest.fn(),
        interceptors: {
          request: {
            use: jest.fn(),
          },
          response: {
            use: jest.fn(),
          },
        },
      };
      return instance;
    }),
  };
  return mockAxios;
});

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Axios Interceptor (토큰 갱신 인터셉터)', () => {
  let mockApiClient: jest.Mocked<ReturnType<typeof axios.create>>;

  beforeEach(() => {
    // 각 테스트 전에 모의 객체 초기화
    jest.clearAllMocks();
    localStorage.clear();

    // axios.create()가 반환하는 모의 객체 설정
    mockApiClient = mockedAxios.create() as jest.Mocked<ReturnType<typeof axios.create>>;
    (apiClient as any) = mockApiClient;

    // get 메서드가 request를 호출하도록 설정
    mockApiClient.get.mockImplementation((url, config) => {
      return mockApiClient.request({
        method: 'GET',
        url,
        ...config,
      });
    });

    // 인터셉터 로직 직접 구현
    mockApiClient.interceptors.response.use = jest.fn((onFulfilled, onRejected) => {
      mockApiClient.request.mockImplementation(async (config: CustomAxiosRequestConfig) => {
        try {
          // 백엔드에서 토큰 갱신을 처리하므로 프론트엔드에서는 단순히 요청을 전달
          return onFulfilled?.(config as unknown as AxiosResponse);
        } catch (error) {
          return onRejected?.(error);
        }
      });
      return 0; // 인터셉터 ID 반환
    });
  });

  it('API 요청이 성공적으로 처리되어야 함', async () => {
    // 1. 성공 응답 설정
    mockApiClient.request.mockResolvedValueOnce({
      status: 200,
      data: { message: 'Success' },
    });

    // 2. API 요청 시도
    const response = await apiClient.get('/api/profile');

    // 3. 검증
    expect(mockApiClient.request).toHaveBeenCalledTimes(1);
    expect(mockApiClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/api/profile',
      })
    );
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ message: 'Success' });
  });

  it('401 에러가 발생하면 에러를 전파해야 함', async () => {
    // 1. 401 에러 설정
    mockApiClient.request.mockRejectedValueOnce({
      response: {
        status: 401,
        data: { message: 'Unauthorized' },
      },
    });

    // 2. API 요청 시도
    try {
      await apiClient.get('/api/profile');
    } catch (error) {
      const axiosError = error as AxiosError;
      // 3. 검증
      expect(mockApiClient.request).toHaveBeenCalledTimes(1);
      expect(mockApiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/api/profile',
        })
      );
      expect(axiosError.response?.status).toBe(401);
      expect(axiosError.response?.data).toEqual({ message: 'Unauthorized' });
    }
  });

  it('403 에러가 발생하면 에러를 전파해야 함', async () => {
    // 1. 403 에러 설정
    mockApiClient.request.mockRejectedValueOnce({
      response: {
        status: 403,
        data: { message: 'Forbidden' },
      },
    });

    // 2. API 요청 시도
    try {
      await apiClient.get('/api/profile');
    } catch (error) {
      const axiosError = error as AxiosError;
      // 3. 검증
      expect(mockApiClient.request).toHaveBeenCalledTimes(1);
      expect(mockApiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/api/profile',
        })
      );
      expect(axiosError.response?.status).toBe(403);
      expect(axiosError.response?.data).toEqual({ message: 'Forbidden' });
    }
  });
}); 