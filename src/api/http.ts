// src/api/http.ts

interface RequestOptions extends RequestInit {
  // Add any custom options here if needed
}

export async function http<T>(
  request: RequestInfo,
  options?: RequestOptions
): Promise<T> {
  const response = await fetch(request, {
    ...options,
    credentials: "include", // Essential for sending cookies (e.g., session tokens)
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || "Something went wrong");
  }

  return response.json();
}

// You can also create specific methods for GET, POST, PUT, DELETE
export const get = <T>(request: RequestInfo, options?: RequestOptions) =>
  http<T>(request, { method: "GET", ...options });

export const post = <T>(request: RequestInfo, data?: any, options?: RequestOptions) =>
  http<T>(request, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  });

export const put = <T>(request: RequestInfo, data?: any, options?: RequestOptions) =>
  http<T>(request, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  });

export const del = <T>(request: RequestInfo, options?: RequestOptions) =>
  http<T>(request, { method: "DELETE", ...options });
