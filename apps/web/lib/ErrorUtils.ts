/**
 * Utility functions for error handling
 */

/**
 * Extracts error message from unknown error type
 *
 * @param error The error to extract from
 * @param defaultMessage Default message if extraction fails
 * @returns Extracted error message
 */
const GetErrorMessage = (error: unknown, defaultMessage: string = "An error occurred"): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const errorObj = error as Record<string, unknown>;
    if (typeof errorObj.message === "string") {
      return errorObj.message;
    }
  }

  return defaultMessage;
};

export default GetErrorMessage;
