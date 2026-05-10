export function getCurrentUser() {
  return localStorage.getItem("legal-hub-current-user");
}

export function loginUser(username: string) {
  localStorage.setItem("legal-hub-current-user", username);
  window.location.href = "/";
}

export function logoutUser() {
  localStorage.removeItem("legal-hub-current-user");
  window.location.href = "/";
}
