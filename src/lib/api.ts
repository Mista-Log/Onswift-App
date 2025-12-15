// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// export async function apiRequest(
//   endpoint: string,
//   options: RequestInit = {}
// ) {
//   const token = localStorage.getItem('onswift_token');

//   const headers: HeadersInit = {
//     'Content-Type': 'application/json',
//     ...(token ? { Authorization: `Token ${token}` } : {}),
//     ...options.headers,
//   };

//   const response = await fetch(`${API_BASE_URL}${endpoint}`, {
//     ...options,
//     headers,
//   });

//   const data = await response.json();

//   if (!response.ok) {
//     throw new Error(data?.detail || data?.error || 'Something went wrong');
//   }

//   return data;
// }

export async function apiRequest(
  url: string,
  options: RequestInit = {}
) {
  const token = localStorage.getItem("onswift_token");

  const headers: HeadersInit = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const isFormData = options.body instanceof FormData;

  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/${url}`,
    {
      ...options,
      headers: isFormData
        ? headers // browser sets boundary automatically
        : {
            "Content-Type": "application/json",
            ...headers,
          },
      body: isFormData ? options.body : options.body,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || "Request failed");
  }

  return data;
}
