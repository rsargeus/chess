import { createAuth0Client, Auth0Client, User } from '@auth0/auth0-spa-js';

declare const __AUTH0_DOMAIN__: string;
declare const __AUTH0_CLIENT_ID__: string;
declare const __AUTH0_AUDIENCE__: string;

let _client: Auth0Client | null = null;

export async function initAuth(): Promise<void> {
  _client = await createAuth0Client({
    domain: __AUTH0_DOMAIN__,
    clientId: __AUTH0_CLIENT_ID__,
    authorizationParams: {
      audience: __AUTH0_AUDIENCE__,
      redirect_uri: window.location.origin,
    },
    useRefreshTokens: true,
    cacheLocation: 'localstorage',
  });

  if (window.location.search.includes('code=') || window.location.search.includes('error=')) {
    try {
      await _client.handleRedirectCallback();
    } catch (e) {
      console.error('Auth0 callback error:', e);
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

export async function isAuthenticated(): Promise<boolean> {
  return _client?.isAuthenticated() ?? false;
}

export async function getToken(): Promise<string> {
  if (!_client) throw new Error('Auth not initialized');
  return _client.getTokenSilently();
}

function parseRolesFromToken(token: string): string[] {
  const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  const roles = (payload['https://chess-api/roles'] as string[]) ?? [];
  return roles.map((r: string) => r.toLowerCase());
}

export async function getRoles(): Promise<string[]> {
  try {
    const token = await _client!.getTokenSilently({ cacheMode: 'off' });
    return parseRolesFromToken(token);
  } catch {
    // cacheMode: 'off' may fail on Safari — fall back to cached token
    try {
      const token = await _client!.getTokenSilently();
      return parseRolesFromToken(token);
    } catch {
      return [];
    }
  }
}

export async function getUser(): Promise<User | undefined> {
  return _client?.getUser();
}

export async function loginWithGoogle(): Promise<void> {
  if (!_client) throw new Error('Auth not initialized');
  await _client.loginWithPopup({
    authorizationParams: { connection: 'google-oauth2' },
  });
}

export async function loginWithEmailPassword(): Promise<void> {
  if (!_client) throw new Error('Auth not initialized');
  await _client.loginWithPopup({
    authorizationParams: { connection: 'Username-Password-Authentication' },
  });
}

export async function logout(): Promise<void> {
  if (!_client) return;
  await _client.logout({ logoutParams: { returnTo: window.location.origin } });
}
