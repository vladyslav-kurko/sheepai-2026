const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

interface ApiErrorBody {
  statusCode: number;
  message: string;
  details?: unknown;
}

function isApiError(body: unknown): body is ApiErrorBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'statusCode' in body &&
    typeof (body as ApiErrorBody).statusCode === 'number' &&
    (body as ApiErrorBody).statusCode >= 400
  );
}

export const customFetch = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 204) return null as T;

  const text = await response.text();
  if (!text) return null as T;

  const body = JSON.parse(text);

  if (isApiError(body)) {
    throw new ApiError(body.statusCode, body.message, body.details);
  }

  return body as T;
};
