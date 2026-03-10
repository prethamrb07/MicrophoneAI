// In-memory JWT storage (never use localStorage per API contract)
let token = null;
let refreshToken = null;
let user = null;

export const auth = {
  getToken: () => token,
  
  setToken: (jwt, refresh, userData) => {
    token = jwt;
    refreshToken = refresh;
    user = userData;
  },

  getUser: () => user,

  clearToken: () => {
    token = null;
    refreshToken = null;
    user = null;
  },

  isAuthenticated: () => !!token,
};
