const DEFAULT_BASE_URL = 'http://localhost:8000';

const getBaseUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL;
  }
  return DEFAULT_BASE_URL;
};

export interface RequestOptions extends RequestInit {
  authToken?: string;
}

export class ApiError extends Error {
  public status: number;
  public details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const data = await response.json().catch(() => undefined);
    throw new ApiError(data?.message ?? response.statusText, response.status, data);
  }
  if (response.status === 204) {
    return undefined;
  }
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return response.text();
};

export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { authToken, headers, ...rest } = options;
  const baseUrl = getBaseUrl();

  const response = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers
    }
  });

  return handleResponse(response) as Promise<T>;
};
