/**
 * Error handling utilities
 */

/**
 * Extracts error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error occurred";
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: string,
  message: string,
  additionalFields?: Record<string, unknown>
): { error: string; message: string; [key: string]: unknown } {
  return {
    error,
    message,
    ...additionalFields,
  };
}

/**
 * Handles errors and returns appropriate HTTP response
 */
export function handleRouteError(
  error: unknown,
  defaultMessage: string = "An error occurred",
  defaultStatus: number = 500
): { status: number; response: { error: string; message: string; [key: string]: unknown } } {
  const errorMessage = getErrorMessage(error);
  
  // Check for validation errors (usually 400)
  if (errorMessage.includes("required") || errorMessage.includes("Invalid") || errorMessage.includes("format")) {
    return {
      status: 400,
      response: createErrorResponse("Validation error", errorMessage),
    };
  }
  
  // Check for not found errors (usually 404)
  if (errorMessage.includes("not found") || errorMessage.includes("not registered")) {
    return {
      status: 404,
      response: createErrorResponse("Not found", errorMessage),
    };
  }
  
  return {
    status: defaultStatus,
    response: createErrorResponse("Server error", errorMessage),
  };
}

