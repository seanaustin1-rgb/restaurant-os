import { decrypt, encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export const GOOGLE_BUSINESS_PROFILE_PROVIDER = "GOOGLE_BUSINESS_PROFILE";
export const GOOGLE_BUSINESS_PROFILE_CATEGORY = "aura";
export const GOOGLE_BUSINESS_PROFILE_SCOPE = "https://www.googleapis.com/auth/business.manage";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
const BUSINESS_INFO_URL = "https://mybusinessbusinessinformation.googleapis.com/v1";

export interface GoogleBusinessProfileLocation {
  accountId: string;
  locationId: string;
  name: string;
  title: string;
  address: string | null;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface AccountResponse {
  accounts?: { name?: string; accountName?: string }[];
}

interface LocationsResponse {
  locations?: {
    name?: string;
    title?: string;
    storefrontAddress?: GoogleBusinessProfileAddress;
  }[];
}

interface GoogleBusinessProfileAddress {
  addressLines?: string[];
  locality?: string;
  administrativeArea?: string;
  postalCode?: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function googleOAuthRedirectUri(): string {
  return `${requiredEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "")}/api/google-business-profile/oauth/callback`;
}

export function googleBusinessProfileAuthUrl(state: string): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", requiredEnv("GOOGLE_BUSINESS_PROFILE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", googleOAuthRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_BUSINESS_PROFILE_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

async function parseTokenResponse(res: Response): Promise<TokenResponse> {
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? `Google OAuth HTTP ${res.status}`);
  }
  return data;
}

export async function exchangeGoogleCode(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: requiredEnv("GOOGLE_BUSINESS_PROFILE_CLIENT_ID"),
    client_secret: requiredEnv("GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET"),
    redirect_uri: googleOAuthRedirectUri(),
    grant_type: "authorization_code",
  });
  return parseTokenResponse(
    await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }),
  );
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: requiredEnv("GOOGLE_BUSINESS_PROFILE_CLIENT_ID"),
    client_secret: requiredEnv("GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET"),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  return parseTokenResponse(
    await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }),
  );
}

function addressText(address?: GoogleBusinessProfileAddress): string | null {
  if (!address) return null;
  return [...(address.addressLines ?? []), [address.locality, address.administrativeArea, address.postalCode].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(", ") || null;
}

function idFromResourceName(resource: string | undefined, prefix: string): string | null {
  if (!resource?.startsWith(prefix)) return null;
  return resource.slice(prefix.length);
}

export async function discoverGoogleBusinessProfileLocations(accessToken: string): Promise<GoogleBusinessProfileLocation[]> {
  const accountsRes = await fetch(ACCOUNTS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const accountsData = (await accountsRes.json().catch(() => ({}))) as AccountResponse & { error?: { message?: string } };
  if (!accountsRes.ok) {
    throw new Error(accountsData.error?.message ?? `Google accounts HTTP ${accountsRes.status}`);
  }

  const locations: GoogleBusinessProfileLocation[] = [];
  for (const account of accountsData.accounts ?? []) {
    const accountId = idFromResourceName(account.name, "accounts/");
    if (!accountId || !account.name) continue;
    const url = new URL(`${BUSINESS_INFO_URL}/${account.name}/locations`);
    url.searchParams.set("readMask", "name,title,storefrontAddress");
    const locRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const locData = (await locRes.json().catch(() => ({}))) as LocationsResponse & { error?: { message?: string } };
    if (!locRes.ok) continue;
    for (const loc of locData.locations ?? []) {
      const locationId = idFromResourceName(loc.name, `${account.name}/locations/`);
      if (!locationId) continue;
      locations.push({
        accountId,
        locationId,
        name: loc.name ?? "",
        title: loc.title ?? account.accountName ?? "Google Business Profile",
        address: addressText(loc.storefrontAddress),
      });
    }
  }
  return locations;
}

export async function accessTokenForGoogleBusinessProfile(restaurantId?: string | null): Promise<string> {
  if (restaurantId) {
    const connection = await prisma.integrationConnection.findFirst({
      where: { restaurantId, provider: GOOGLE_BUSINESS_PROFILE_PROVIDER, isActive: true },
      orderBy: { updatedAt: "desc" },
      select: { id: true, accessToken: true, refreshToken: true },
    });
    if (connection?.refreshToken) {
      const refreshed = await refreshGoogleAccessToken(decrypt(connection.refreshToken));
      await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: encrypt(refreshed.access_token!),
          expiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null,
        },
      });
      return refreshed.access_token!;
    }
    if (connection?.accessToken) return decrypt(connection.accessToken);
  }

  const envRefresh = process.env.GOOGLE_BUSINESS_PROFILE_REFRESH_TOKEN?.trim();
  if (envRefresh) {
    const refreshed = await refreshGoogleAccessToken(envRefresh);
    return refreshed.access_token!;
  }
  const envAccess = process.env.GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN?.trim();
  if (envAccess) return envAccess;
  throw new Error("Google Business Profile authorization is missing.");
}
