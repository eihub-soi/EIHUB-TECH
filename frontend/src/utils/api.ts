import { auth as firebaseAuth } from "../firebase/client";

/**
 * Returns authorization headers containing the active user's Firebase ID token
 * or their local demo identifier.
 */
export const getAuthHeaders = async (forceRefresh = false): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (firebaseAuth) {
    try {
      if (typeof (firebaseAuth as any).authStateReady === 'function') {
        await firebaseAuth.authStateReady();
      }
    } catch {
      // Ignore authStateReady error
    }

    if (firebaseAuth.currentUser) {
      try {
        const token = await firebaseAuth.currentUser.getIdToken(forceRefresh);
        if (token) {
          localStorage.setItem("ei_hub_auth_token", token);
          headers["Authorization"] = `Bearer ${token}`;
          return headers;
        }
      } catch {
        // Safe silent fallback to cached token
      }
    }
  }

  const cachedToken = localStorage.getItem("ei_hub_auth_token");
  if (cachedToken) {
    headers["Authorization"] = `Bearer ${cachedToken}`;
  } else {
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
  options: RequestInit & { timeout?: number; retryOn401?: boolean } = {},
): Promise<any> => {
  const { timeout = 10000, retryOn401 = true, ...fetchOptions } = options;
  
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
    let response = await fetch(url, mergedOptions);
    if (id) clearTimeout(id);

    // If request failed with 401 and retryOn401 is enabled, attempt one force-refresh of Firebase ID token
    if (response.status === 401 && retryOn401 && firebaseAuth?.currentUser) {
      try {
        const freshHeaders = await getAuthHeaders(true);
        const retryOptions = {
          ...mergedOptions,
          headers: {
            ...freshHeaders,
            ...(fetchOptions.headers || {}),
          },
        };
        const retryResponse = await fetch(url, retryOptions);
        if (retryResponse.ok) {
          response = retryResponse;
        }
      } catch {
        // Fall through to standard error handling
      }
    }

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
        throw error;
      }
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    throw error;
  }
};
