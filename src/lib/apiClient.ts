/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Galatasaray SK Platform API & Telemetry Client
 *
 * Resolves the production API base URL for both same-origin Cloud Run deployments
 * and cross-origin static Netlify manual folder deployments, adds CORS-compatible
 * request handling, request timeouts, AbortController support, response content-type
 * validation, and safe telemetry diagnostics.
 */

const DEFAULT_PRODUCTION_BACKEND_URL =
  'https://ais-pre-2ogzxwcpbrpxkhvs5esgzn-97089877236.europe-west2.run.app';

export interface TelemetryDiagnosticRecord {
  timestamp: string;
  endpoint: string;
  resolvedTargetOrigin: string;
  success: boolean;
  httpStatus: number | null;
  durationMs: number;
  errorCategory:
    | 'NONE'
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
 * Determines whether the current browser origin is a static hosting domain
 * (such as *.netlify.app) or whether an explicit VITE_API_BASE_URL is configured.
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

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    // Same-origin when running on AI Studio Cloud Run (*.run.app) or local Express dev server
    const isSameOriginFullStack =
      host.endsWith('.run.app') || host === 'localhost' || host === '127.0.0.1';

    if (isSameOriginFullStack) {
      return {
        baseUrl: '',
        explicitlyConfigured: false,
        isCrossOriginStaticHost: false,
      };
    }

    // Running on Netlify (*.netlify.app) or custom domain uploaded manually:
    // Route API requests to the provisioned Cloud Run backend service URL
    return {
      baseUrl: DEFAULT_PRODUCTION_BACKEND_URL,
      explicitlyConfigured: false,
      isCrossOriginStaticHost: true,
    };
  }

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
 * Drop-in replacement for window.fetch that automatically routes `/api/*` requests
 * to the configured backend server when hosted on Netlify or another static host.
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
      headers.set('Accept', 'application/json');
    }

    const response = await window.fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });

    // If a relative request on a static host accidentally returned HTML (e.g. index.html fallback),
    // automatically retry once against the production Cloud Run backend URL.
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (
      input.startsWith('/api/') &&
      !url.startsWith('http') &&
      contentType.includes('text/html')
    ) {
      const fallbackUrl = `${DEFAULT_PRODUCTION_BACKEND_URL}${input}`;
      return await window.fetch(fallbackUrl, {
        ...init,
        headers,
        signal: controller.signal,
      });
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
