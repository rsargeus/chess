interface TokenCache { access_token: string; expires_at: number; }
let tokenCache: TokenCache | null = null;

async function getManagementToken(): Promise<string> {
  if (tokenCache && tokenCache.expires_at > Date.now() + 5000) {
    return tokenCache.access_token;
  }
  const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: process.env.AUTH0_MANAGEMENT_CLIENT_ID,
      client_secret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
      audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
    }),
  });
  const data = await res.json() as { access_token: string; expires_in: number };
  tokenCache = { access_token: data.access_token, expires_at: Date.now() + data.expires_in * 1000 };
  return tokenCache.access_token;
}

// Short-lived cache to avoid hammering Auth0 Management API
const rolesCache = new Map<string, { roles: string[]; expiresAt: number }>();
const ROLES_CACHE_TTL_MS = 30_000;

export async function getUserRoles(userId: string): Promise<string[]> {
  const cached = rolesCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.roles;

  const token = await getManagementToken();
  const res = await fetch(
    `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}/roles`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Auth0 get roles failed: ${JSON.stringify(err)}`);
  }
  const data = await res.json() as { name: string }[];
  const roles = data.map(r => r.name.toLowerCase());
  rolesCache.set(userId, { roles, expiresAt: Date.now() + ROLES_CACHE_TTL_MS });
  return roles;
}

export function invalidateRolesCache(userId: string): void {
  rolesCache.delete(userId);
}

export async function assignPremiumRole(userId: string): Promise<void> {
  const token = await getManagementToken();
  const res = await fetch(
    `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}/roles`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles: [process.env.AUTH0_PREMIUM_ROLE_ID] }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Auth0 role assignment failed: ${JSON.stringify(err)}`);
  }
}
