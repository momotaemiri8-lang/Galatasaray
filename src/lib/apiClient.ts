/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Galatasaray SK Platform API & Telemetry Client
 *
 * Resolves the production API base URL for both same-origin server deployments
 * and static Netlify manual folder deployments, adds automatic static .json
 * fallback, CORS-compatible headers, request timeouts, and diagnostic records.
 */

export interface TelemetryDiagnosticRecord {
  timestamp: string;
  endpoint: string;
  resolvedTargetOrigin: string;
  success: boolean;
  httpStatus: number | null;
  durationMs: number;
  errorCategory:
    | 'NONE'
    | 'STATIC_CDN_FALLBACK'
    | 'STATIC_HOST_HTML_FALLBACK'
    | 'NETWORK_OR_CORS'
    | 'TIMEOUT'
    | 'UNAUTHORIZED_401'
    | 'FORBIDDEN_403'
    | 'HTTP_ERROR'
    | 'INVALID_JSON_STRUCTURE'
    | 'ABORTED';
  safeMessage: string;
  apiBaseUrlConfigured: boolean;
  usedFallbackOrigin: boolean;
}

/**
 * Determines whether an explicit VITE_API_BASE_URL is configured
 * or whether the app is running in same-origin mode.
 */
export function resolveApiConfig(): {
  baseUrl: string;
  explicitlyConfigured: boolean;
  isCrossOriginStaticHost: boolean;
} {
  const envUrl = String((import.meta as any).env?.VITE_API_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '');

  if (envUrl && !envUrl.toLowerCase().includes('placeholder')) {
    return {
      baseUrl: envUrl,
      explicitlyConfigured: true,
      isCrossOriginStaticHost: true,
    };
  }

  // When no remote API URL is explicitly configured, use relative same-origin paths.
  // Netlify routes /api/* to the static json files or local endpoints.
  return {
    baseUrl: '',
    explicitlyConfigured: false,
    isCrossOriginStaticHost: false,
  };
}

export function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const { baseUrl } = resolveApiConfig();
  return baseUrl ? `${baseUrl}${cleanPath}` : cleanPath;
}

/**
 * Drop-in replacement for window.fetch that automatically routes `/api/*` requests,
 * applies timeouts, and on static hosts (like Netlify) falls back to static `.json` files
 * if the naked endpoint returns 404 or an HTML SPA fallback.
 */
export async function apiFetch(
  input: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const url = input.startsWith('/api/') ? buildApiUrl(input) : input;
  const timeoutMs = init?.timeoutMs ?? 14000;

  const controller = new AbortController();
  const callerSignal = init?.signal;

  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener('change', onCallerAbort);
      callerSignal.addEventListener('abort', onCallerAbort);
    }
  }

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const headers = new Headers(init?.headers || {});
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json, text/plain, */*');
    }

    let response: Response;
    try {
      response = await window.fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });
    } catch (networkErr: any) {
      // If relative API call failed on static host, try .json static payload fallback
      if (
        input.startsWith('/api/') &&
        !input.endsWith('.json') &&
        (!init?.method || init.method.toUpperCase() === 'GET')
      ) {
        try {
          const jsonFallbackUrl = `${input}.json`;
          const fallbackRes = await window.fetch(jsonFallbackUrl, {
            ...init,
            headers,
            signal: controller.signal,
          });
          if (fallbackRes.ok) return fallbackRes;
        } catch {
          // Rethrow original error if fallback also fails
        }
      }
      throw networkErr;
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    // If a GET /api/* request returned HTML (Netlify SPA index.html fallback) or 404:
    // try the corresponding static .json asset
    if (
      input.startsWith('/api/') &&
      !input.endsWith('.json') &&
      (!init?.method || init.method.toUpperCase() === 'GET') &&
      (contentType.includes('text/html') || response.status === 404)
    ) {
      try {
        const jsonFallbackUrl = `${input}.json`;
        const fallbackRes = await window.fetch(jsonFallbackUrl, {
          ...init,
          headers,
          signal: controller.signal,
        });
        const fallbackContentType = (fallbackRes.headers.get('content-type') || '').toLowerCase();
        if (fallbackRes.ok && !fallbackContentType.includes('text/html')) {
          return fallbackRes;
        }
      } catch {
        // Fall back to returning original response
      }
    }

    return response;
  } finally {
    clearTimeout(timer);
    if (callerSignal) {
      callerSignal.removeEventListener('abort', onCallerAbort);
    }
  }
}

/**
 * Validates that a bootstrap telemetry payload contains the expected top-level arrays
 * and normalizes any missing optional collections safely.
 */
export function validateAndNormalizeBootstrapPayload(raw: any): {
  valid: boolean;
  normalized?: any;
  reason?: string;
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, reason: 'Telemetry response is not a valid JSON object.' };
  }

  const hasCoreCollection =
    Array.isArray(raw.players) ||
    Array.isArray(raw.matches) ||
    Array.isArray(raw.products) ||
    (raw.matchCentre && Array.isArray(raw.matchCentre.matches));

  if (!hasCoreCollection) {
    return {
      valid: false,
      reason: 'Telemetry payload is missing core club collections (players, matches, products).',
    };
  }

  const matchCentreObj =
    raw.matchCentre && typeof raw.matchCentre === 'object' ? raw.matchCentre : {};

  return {
    valid: true,
    normalized: {
      players: Array.isArray(raw.players) ? raw.players : [],
      matches: Array.isArray(raw.matches) ? raw.matches : [],
      membershipTiers: Array.isArray(raw.membershipTiers) ? raw.membershipTiers : [],
      meetSessions: Array.isArray(raw.meetSessions) ? raw.meetSessions : [],
      products: Array.isArray(raw.products) ? raw.products : [],
      auctions: Array.isArray(raw.auctions) ? raw.auctions : [],
      articles: Array.isArray(raw.articles) ? raw.articles : [],
      configurations: Array.isArray(raw.configurations) ? raw.configurations : [],
      recentBids: Array.isArray(raw.recentBids) ? raw.recentBids : [],
      integrationSummary: Array.isArray(raw.integrationSummary) ? raw.integrationSummary : [],
      matchCentre: {
        config:
          matchCentreObj.config && typeof matchCentreObj.config === 'object'
            ? matchCentreObj.config
            : {},
        matches: Array.isArray(matchCentreObj.matches)
          ? matchCentreObj.matches
          : Array.isArray(raw.matches)
          ? raw.matches
          : [],
        events: Array.isArray(matchCentreObj.events) ? matchCentreObj.events : [],
        lineups: Array.isArray(matchCentreObj.lineups) ? matchCentreObj.lineups : [],
        standings: Array.isArray(matchCentreObj.standings) ? matchCentreObj.standings : [],
      },
    },
  };
}
