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

export async function getUserRoles(userId: string): Promise<string[]> {
  const token = await getManagementToken();
  const res = await fetch(
    `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}/roles`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Auth0 get roles failed: ${JSON.stringify(err)}`);
  }
  const roles = await res.json() as { name: string }[];
  return roles.map(r => r.name.toLowerCase());
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
