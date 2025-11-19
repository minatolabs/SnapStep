/**
 * Utility functions for handling API errors
 */

export interface ApiError {
  type?: string;
  loc?: (string | number)[];
  msg?: string;
  input?: any;
  url?: string;
}

/**
 * Extract a human-readable error message from an API error response
 */
export function getErrorMessage(error: any): string {
  // If it's already a string, return it
  if (typeof error === 'string') {
    return error;
  }
  
  // If error is null or undefined
  if (!error) {
    return 'An error occurred';
  }

  // Handle axios error responses
  const detail = error?.response?.data?.detail;
  
  if (!detail) {
    return error?.message || 'An error occurred';
  }

  // If detail is a string, return it
  if (typeof detail === 'string') {
    return detail;
  }

  // If detail is an array (validation errors)
  if (Array.isArray(detail)) {
    return detail
      .map((e: ApiError | string) => {
        if (typeof e === 'string') {
          return e;
        }
        // Format validation error: "field_name: error message"
        const field = e.loc && e.loc.length > 0 
          ? e.loc[e.loc.length - 1] 
          : 'field';
        return `${field}: ${e.msg || JSON.stringify(e)}`;
      })
      .join(', ');
  }

  // If detail is an object
  if (typeof detail === 'object') {
    // Check if it has a 'msg' property
    if (detail.msg) {
      const field = detail.loc && detail.loc.length > 0 
        ? detail.loc[detail.loc.length - 1] 
        : '';
      return field ? `${field}: ${detail.msg}` : detail.msg;
    }
    // Otherwise stringify it
    return JSON.stringify(detail);
  }

  return 'An error occurred';
}

