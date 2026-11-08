/**
 * API Response Utilities
 *
 * Standardizes API response format across all routes.
 * Ensures consistent error handling and response structure.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

// ============================================
// Response Types
// ============================================

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  errorCode?: string;
  details?: unknown;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================
// Type Guards
// ============================================

/**
 * Type guard to check if response is success
 */
export function isSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard to check if response is error
 */
export function isError<T>(response: ApiResponse<T>): response is ApiErrorResponse {
  return response.success === false;
}

// ============================================
// Success Responses
// ============================================

/**
 * Create a success response with data
 */
export function success<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
  if (message) {
    response.message = message;
  }
  return NextResponse.json(response, { status });
}

/**
 * Create a success response for creation operations
 */
export function created<T>(
  data: T,
  message: string = 'Created successfully'
): NextResponse<ApiSuccessResponse<T>> {
  return success(data, message, 201);
}

/**
 * Create a success response for deletion operations
 */
export function deleted(
  message: string = 'Deleted successfully'
): NextResponse<ApiSuccessResponse<null>> {
  return success(null, message, 200);
}

// ============================================
// Error Responses
// ============================================

/**
 * Create a bad request error response
 */
export function badRequest(error: string, details?: unknown): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    success: false,
    error,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
  if (details) {
    response.details = details;
  }
  return NextResponse.json(response, { status: 400 });
}

/**
 * Create an unauthorized error response
 */
export function unauthorized(error: string = 'Unauthorized'): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      errorCode: 'UNAUTHORIZED',
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status: 401 }
  );
}

/**
 * Create a forbidden error response
 */
export function forbidden(error: string = 'Forbidden'): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      errorCode: 'FORBIDDEN',
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status: 403 }
  );
}

/**
 * Create a not found error response
 */
export function notFound(error: string = 'Resource not found'): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      errorCode: 'NOT_FOUND',
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status: 404 }
  );
}

/**
 * Create a rate limit error response
 */
export function rateLimit(
  retryAfter: number,
  error: string = 'Too many requests'
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      errorCode: 'RATE_LIMITED',
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    }
  );
}

/**
 * Create a 503 response for media operations while the client's R2 storage is
 * not active yet (deferred R2 mode, v1.3.78: onboarding deploys without R2 and
 * the client activates it later via the handover wizard). Gates that guard
 * media endpoints use this instead of leaking env-key names in a 500.
 */
export function mediaDisabled(): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: 'Media belum diaktifkan. Selesaikan aktivasi media (R2) terlebih dahulu.',
      errorCode: 'MEDIA_DISABLED',
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status: 503 }
  );
}

/**
 * Create an internal server error response
 */
export function serverError(
  error: string = 'Internal server error',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    success: false,
    error,
    errorCode: 'INTERNAL_ERROR',
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
  if (details) {
    response.details = details;
  }
  return NextResponse.json(response, { status: 500 });
}

// ============================================
// Validation Error Handling
// ============================================

/**
 * Create a validation error response from ZodError
 */
export function validationError(zodError: ZodError): NextResponse<ApiErrorResponse> {
  const formattedErrors = zodError.format();

  return NextResponse.json(
    {
      success: false,
      error: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
      details: formattedErrors,
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status: 400 }
  );
}

// ============================================
// Error Logging Helper
// ============================================

/**
 * Log API error with consistent format
 */
export function logError(route: string, error: unknown): void {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[API Error] ${timestamp} | ${route}:`, errorMessage);
  if (errorStack) {
    console.error('Stack:', errorStack);
  }
}

// ============================================
// Client-side Helpers
// ============================================

/**
 * Safely parse API response with type checking
 */
export async function parseApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const data = await response.json();
  return data as ApiResponse<T>;
}

/**
 * Handle API response with callbacks
 */
export function handleApiResponse<T>(
  response: ApiResponse<T>,
  handlers: {
    onSuccess: (data: T, message?: string) => void;
    onError: (code: string, message: string, details?: unknown) => void;
  }
): void {
  if (isSuccess(response)) {
    handlers.onSuccess(response.data, response.message);
  } else {
    handlers.onError(response.errorCode || 'UNKNOWN_ERROR', response.error, response.details);
  }
}
