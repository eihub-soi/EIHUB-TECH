import { auth as firebaseAuth } from "../firebase/client";

/**
 * Returns authorization headers containing the active user's Firebase ID token
 * or their local demo identifier.
 */
export const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (firebaseAuth && firebaseAuth.currentUser) {
    try {
      // Force refresh of the token to ensure it isn't expired
      const token = await firebaseAuth.currentUser.getIdToken(true);
      headers["Authorization"] = `Bearer ${token}`;
    } catch (e) {
      console.error("[API Helper] Error getting Firebase ID token:", e);
    }
  } else {
    // Fallback for role switching / local demo sessions
    const savedId = localStorage.getItem("ei_hub_active_user_id");
    if (savedId) {
      headers["Authorization"] = `Bearer ${savedId}`;
    }
  }

  return headers;
};

/**
 * Makes an authenticated request to the Python backend
 */
export const apiRequest = async (
  url: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<any> => {
  const { timeout = 10000, ...fetchOptions } = options;
  
  const headers = await getAuthHeaders();
  const mergedOptions = {
    ...fetchOptions,
    headers: {
      ...headers,
      ...(fetchOptions.headers || {}),
    },
  };

  const hasExternalSignal = !!options.signal;
  const controller = hasExternalSignal ? null : new AbortController();
  const signal = options.signal || controller!.signal;
  const id = controller ? setTimeout(() => controller.abort(), timeout) : null;
  mergedOptions.signal = signal;

  try {
    const response = await fetch(url, mergedOptions);
    if (id) clearTimeout(id);

    if (!response.ok) {
      const errorText = await response.text();
      let parsedError;
      try {
        parsedError = JSON.parse(errorText);
      } catch {
        parsedError = { detail: errorText };
      }
      
      const detail = parsedError.detail || `HTTP Error ${response.status}`;
      
      let friendlyMessage = detail;
      switch (response.status) {
        case 401: friendlyMessage = `Unauthorized: ${detail}`; break;
        case 403: friendlyMessage = `Forbidden: ${detail}`; break;
        case 404: friendlyMessage = `Not Found: ${detail}`; break;
        case 409: friendlyMessage = `Conflict: ${detail}`; break;
        case 422: friendlyMessage = `Validation Error: ${detail}`; break;
        case 429: friendlyMessage = `Too Many Requests: ${detail}`; break;
        case 500: friendlyMessage = `Server Error: ${detail}`; break;
      }

      throw new Error(friendlyMessage);
    }

    // Attempt to parse JSON, if it fails return text or null
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return text;
    }
  } catch (error: any) {
    if (id) clearTimeout(id);
    if (error.name === 'AbortError') {
      if (hasExternalSignal) {
        // Propagate standard AbortError if cancelled externally
        throw error;
      }
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    throw error;
  }
};
