/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import {
  apiFetch,
  resolveApiConfig,
  validateAndNormalizeBootstrapPayload,
  TelemetryDiagnosticRecord,
} from './lib/apiClient.ts';
import { DigitalMembershipCard } from './components/DigitalMembershipCard.tsx';
import { GlobalShippingMap } from './components/GlobalShippingMap.tsx';
import { AdminControlCenter } from './components/AdminControlCenter.tsx';
import { AuthPortal, AuthViewMode } from './components/AuthPortal.tsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  ShoppingBag,
  Award,
  Calendar,
  Truck,
  ShieldCheck,
  UserCheck,
  Gavel,
  GraduationCap,
  ChevronRight,
  LogOut,
  CheckCircle2,
  X,
  Plus,
  Minus,
  HelpCircle,
  Trophy,
  Activity,
  Tv,
  BarChart3,
  Menu,
  Clock,
  MapPin,
  AlertCircle,
  Play,
  SlidersHorizontal,
  ArrowUpRight,
  RefreshCw,
  Mail,
  Sparkles,
  Globe,
} from 'lucide-react';

type ActiveModule =
  | 'home'
  | 'match-centre'
  | 'fixtures'
  | 'squad'
  | 'news'
  | 'statistics'
  | 'meet'
  | 'store'
  | 'auctions'
  | 'academy'
  | 'membership'
  | 'shipping'
  | 'dashboard'
  | 'admin'
  | 'auth'
  | 'legal';

interface CartItem {
  productId: number;
  name: string;
  priceEur: number;
  size: string;
  qty: number;
  imageUrl: string;
}

export default function App() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('gs_session_token') || null;
    } catch {
      return null;
    }
  });
  const [authInitialMode, setAuthInitialMode] = useState<AuthViewMode>('login');
  const [authInitialToken, setAuthInitialToken] = useState<string>('');

  const [publicData, setPublicData] = useState<any>({
    players: [],
    matches: [],
    membershipTiers: [],
    meetSessions: [],
    products: [],
    auctions: [],
    articles: [],
    configurations: [],
    recentBids: [],
    matchCentre: {
      config: {},
      matches: [],
      events: [],
      lineups: [],
      standings: [],
    },
  });
  const [userBundle, setUserBundle] = useState<any>(null);
  const [loadingPublic, setLoadingPublic] = useState<boolean>(true);
  const [retryingBootstrap, setRetryingBootstrap] = useState<boolean>(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [telemetryDiagnostic, setTelemetryDiagnostic] =
    useState<TelemetryDiagnosticRecord | null>(null);
  const [lastSuccessfulTelemetryAt, setLastSuccessfulTelemetryAt] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const bootstrapRequestSeqRef = useRef<number>(0);
  const bootstrapAbortRef = useRef<AbortController | null>(null);
  const consecutivePollFailuresRef = useRef<number>(0);

  // Match Centre & Fixtures Interactive States
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [matchCentreTab, setMatchCentreTab] = useState<'overview' | 'lineups' | 'stats' | 'timeline'>(
    'overview'
  );
  const [fixtureStatusFilter, setFixtureStatusFilter] = useState<'ALL' | 'UPCOMING' | 'COMPLETED'>(
    'ALL'
  );
  const [fixtureCompetitionFilter, setFixtureCompetitionFilter] = useState<string>('ALL');
  const [fixtureVenueFilter, setFixtureVenueFilter] = useState<'ALL' | 'HOME' | 'AWAY'>('ALL');
  const [autoPollEnabled, setAutoPollEnabled] = useState<boolean>(true);

  // Squad Filtering & Player Modal
  const [squadCategoryFilter, setSquadCategoryFilter] = useState<string>('All');
  const [squadPositionFilter, setSquadPositionFilter] = useState<string>('All');
  const [squadSearchQuery, setSquadSearchQuery] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

  // News & Media Hub States
  const [newsCategoryFilter, setNewsCategoryFilter] = useState<string>('All');
  const [newsSearchQuery, setNewsSearchQuery] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);

  // Store & Multi-Step Checkout State
  const [storeCategoryFilter, setStoreCategoryFilter] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([
    {
      productId: 1,
      name: '2026/27 Authentic Parçalı Match Jersey',
      priceEur: 139.0,
      size: 'L',
      qty: 1,
      imageUrl: '/src/assets/images/product_official_home_kit_1791538209587.jpg',
    },
  ]);
  const [checkoutStep, setCheckoutStep] = useState<number>(1);
  const [customerName, setCustomerName] = useState<string>('');
  const [shippingAddress, setShippingAddress] = useState<string>('Bagdat Caddesi No. 105');
  const [shippingCity, setShippingCity] = useState<string>('London');
  const [shippingCountry, setShippingCountry] = useState<string>('United Kingdom');
  const [shippingMethod, setShippingMethod] = useState<string>('Express Priority');
  const [paymentProvider, setPaymentProvider] = useState<string>('Bank Transfer');
  const [stripePaymentIntentId, setStripePaymentIntentId] = useState<string>('');
  const [paypalOrderIdInput, setPaypalOrderIdInput] = useState<string>('');
  const [discountCode, setDiscountCode] = useState<string>('CIMBOM1905');
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  // Auction Bid Inputs
  const [bidInputs, setBidInputs] = useState<Record<number, string>>({});

  // Meet the Stars Booking Form
  const [selectedSessionId, setSelectedSessionId] = useState<number>(1);
  const [meetParticipants, setMeetParticipants] = useState<number>(1);
  const [meetSpecialRequest, setMeetSpecialRequest] = useState<string>(
    'Signed 2026/27 Home Jersey personalization request'
  );

  // Academy Application Form
  const [acadName, setAcadName] = useState<string>('');
  const [acadDob, setAcadDob] = useState<string>('2008-06-15');
  const [acadNationality, setAcadNationality] = useState<string>('Turkish');
  const [acadCountry, setAcadCountry] = useState<string>('Turkey');
  const [acadClub, setAcadClub] = useState<string>('Istanbul Youth Academy SK');
  const [acadPosition, setAcadPosition] = useState<string>('Central Midfielder (#8)');
  const [acadFoot, setAcadFoot] = useState<string>('Right');
  const [acadHeight, setAcadHeight] = useState<string>('181');
  const [acadWeight, setAcadWeight] = useState<string>('72');
  const [acadPhone, setAcadPhone] = useState<string>('+90 532 190 5000');
  const [acadVideo, setAcadVideo] = useState<string>('https://video.galatasaray.org/scouting-reel');
  const [acadStatement, setAcadStatement] = useState<string>(
    'Committed to high-intensity pressing, tactical discipline, and representing Galatasaray SK internationally.'
  );

  // Global Shipping Tracking State
  const [trackingQuery, setTrackingQuery] = useState<string>('GS-INTL-19058824TR');
  const [trackedResult, setTrackedResult] = useState<any>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  // Global Search Overlay
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');

  // Support Ticket Form
  const [supportCategory, setSupportCategory] = useState<string>('Order Support');
  const [supportSubject, setSupportSubject] = useState<string>('');
  const [supportMessage, setSupportMessage] = useState<string>('');

  // Footer Newsletter Subscription
  const [newsletterEmail, setNewsletterEmail] = useState<string>('');
  const [newsletterStatus, setNewsletterStatus] = useState<string | null>(null);

  // QR Verification Result Modal
  const [qrVerificationResult, setQrVerificationResult] = useState<any>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const navigateToModule = (mod: ActiveModule) => {
    setActiveModule(mod);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadBootstrapData = async (isManualRetry = false) => {
    const seq = ++bootstrapRequestSeqRef.current;

    if (bootstrapAbortRef.current) {
      bootstrapAbortRef.current.abort();
    }
    const controller = new AbortController();
    bootstrapAbortRef.current = controller;

    if (isManualRetry) {
      setRetryingBootstrap(true);
    }
    setBootstrapError(null);

    const startMs = Date.now();
    const apiCfg = resolveApiConfig();
    const resolvedTargetOrigin = apiCfg.baseUrl || window.location.origin;

    try {
      const res = await apiFetch('/api/bootstrap', {
        signal: controller.signal,
        timeoutMs: 14000,
      });

      if (seq !== bootstrapRequestSeqRef.current) return;

      const durationMs = Date.now() - startMs;
      const contentType = (res.headers.get('content-type') || '').toLowerCase();

      if (contentType.includes('text/html')) {
        const msg =
          'Static host HTML fallback detected instead of JSON telemetry. Ensure the dist folder (with _redirects) is deployed or VITE_API_BASE_URL is configured.';
        setBootstrapError('Unable to load club platform telemetry.');
        setTelemetryDiagnostic({
          timestamp: new Date().toISOString(),
          endpoint: '/api/bootstrap',
          resolvedTargetOrigin,
          success: false,
          httpStatus: res.status,
          durationMs,
          errorCategory: 'STATIC_HOST_HTML_FALLBACK',
          safeMessage: msg,
          apiBaseUrlConfigured: apiCfg.explicitlyConfigured,
          usedFallbackOrigin: apiCfg.isCrossOriginStaticHost,
        });
        return;
      }

      if (!res.ok) {
        const category =
          res.status === 401
            ? 'UNAUTHORIZED_401'
            : res.status === 403
            ? 'FORBIDDEN_403'
            : 'HTTP_ERROR';
        let errDetail = `Backend responded with HTTP ${res.status}.`;
        try {
          const errJson = await res.json();
          if (errJson?.error) errDetail = String(errJson.error);
        } catch {
          // Ignore non-JSON error body
        }
        setBootstrapError('Unable to load club platform telemetry.');
        setTelemetryDiagnostic({
          timestamp: new Date().toISOString(),
          endpoint: '/api/bootstrap',
          resolvedTargetOrigin,
          success: false,
          httpStatus: res.status,
          durationMs,
          errorCategory: category,
          safeMessage: errDetail,
          apiBaseUrlConfigured: apiCfg.explicitlyConfigured,
          usedFallbackOrigin: apiCfg.isCrossOriginStaticHost,
        });
        return;
      }

      let rawData: any = null;
      try {
        rawData = await res.json();
      } catch {
        setBootstrapError('Unable to load club platform telemetry.');
        setTelemetryDiagnostic({
          timestamp: new Date().toISOString(),
          endpoint: '/api/bootstrap',
          resolvedTargetOrigin,
          success: false,
          httpStatus: res.status,
          durationMs,
          errorCategory: 'INVALID_JSON_STRUCTURE',
          safeMessage: 'Response body could not be parsed as valid JSON.',
          apiBaseUrlConfigured: apiCfg.explicitlyConfigured,
          usedFallbackOrigin: apiCfg.isCrossOriginStaticHost,
        });
        return;
      }

      const validated = validateAndNormalizeBootstrapPayload(rawData);
      if (!validated.valid || !validated.normalized) {
        setBootstrapError('Unable to load club platform telemetry.');
        setTelemetryDiagnostic({
          timestamp: new Date().toISOString(),
          endpoint: '/api/bootstrap',
          resolvedTargetOrigin,
          success: false,
          httpStatus: res.status,
          durationMs,
          errorCategory: 'INVALID_JSON_STRUCTURE',
          safeMessage: validated.reason || 'Unexpected telemetry payload structure.',
          apiBaseUrlConfigured: apiCfg.explicitlyConfigured,
          usedFallbackOrigin: apiCfg.isCrossOriginStaticHost,
        });
        return;
      }

      const data = validated.normalized;
      setPublicData(data);
      setBootstrapError(null);
      consecutivePollFailuresRef.current = 0;

      const nowIso = new Date().toISOString();
      setLastSuccessfulTelemetryAt(nowIso);
      setTelemetryDiagnostic({
        timestamp: nowIso,
        endpoint: '/api/bootstrap',
        resolvedTargetOrigin,
        success: true,
        httpStatus: res.status,
        durationMs,
        errorCategory: 'NONE',
        safeMessage: `Verified ${data.players.length} squad profiles, ${data.matches.length} fixtures, and ${data.products.length} GSStore items (${durationMs}ms).`,
        apiBaseUrlConfigured: apiCfg.explicitlyConfigured,
        usedFallbackOrigin: apiCfg.isCrossOriginStaticHost,
      });

      if (data.meetSessions?.length && !selectedSessionId) {
        setSelectedSessionId(data.meetSessions[0].id);
      }
      const matchesArr = data.matchCentre?.matches || data.matches || [];
      if (matchesArr.length && selectedMatchId === null) {
        const derbyOrFirst =
          matchesArr.find((m: any) => m.opponent?.includes('Fenerbahçe')) || matchesArr[0];
        setSelectedMatchId(derbyOrFirst.id);
      }
      if (isManualRetry) {
        showToast('Platform telemetry connection restored.');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' && seq !== bootstrapRequestSeqRef.current) {
        return;
      }
      if (seq !== bootstrapRequestSeqRef.current) return;

      const durationMs = Date.now() - startMs;
      const isTimeout = err?.name === 'AbortError';
      setBootstrapError('Unable to load club platform telemetry.');
      setTelemetryDiagnostic({
        timestamp: new Date().toISOString(),
        endpoint: '/api/bootstrap',
        resolvedTargetOrigin,
        success: false,
        httpStatus: null,
        durationMs,
        errorCategory: isTimeout ? 'TIMEOUT' : 'NETWORK_OR_CORS',
        safeMessage: isTimeout
          ? `Request timed out after ${durationMs}ms while contacting backend.`
          : 'Network or cross-origin connection error while reaching Galatasaray SK backend.',
        apiBaseUrlConfigured: apiCfg.explicitlyConfigured,
        usedFallbackOrigin: apiCfg.isCrossOriginStaticHost,
      });
    } finally {
      if (seq === bootstrapRequestSeqRef.current) {
        setLoadingPublic(false);
        setRetryingBootstrap(false);
      }
    }
  };

  const loadTrackedShipment = async (num: string, useLiveDhl = false) => {
    setTrackingError(null);
    try {
      const querySuffix = useLiveDhl ? '?mode=dhl_live' : '';
      const res = await apiFetch(
        `/api/shipments/track/${encodeURIComponent(num.trim())}${querySuffix}`
      );
      const data = await res.json();
      if (!res.ok) {
        setTrackingError(data.error || 'Shipment not found.');
        setTrackedResult(null);
      } else {
        setTrackedResult(data);
      }
    } catch (err) {
      setTrackingError('Unable to reach logistics tracking gateway.');
    }
  };

  const loadUserDashboard = async (token: string) => {
    try {
      const res = await apiFetch('/api/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUserBundle(data);
        if (data.profile?.fullName && !customerName) {
          setCustomerName(data.profile.fullName);
        }
      }
    } catch (err) {
      console.error('Failed to load user bundle:', err);
    }
  };

  useEffect(() => {
    loadBootstrapData(false);
    loadTrackedShipment('GS-INTL-19058824TR');

    // Automatically recover when browser network connectivity returns
    const handleOnline = () => {
      loadBootstrapData(false);
    };
    window.addEventListener('online', handleOnline);

    // Inspect URL query parameters for ?authAction=verify-email&token=... or ?authAction=reset-password&token=...
    try {
      const params = new URLSearchParams(window.location.search);
      const action = params.get('authAction');
      const tokenParam = params.get('token') || '';
      if (action === 'verify-email' || action === 'reset-password') {
        setAuthInitialMode(action);
        setAuthInitialToken(tokenParam);
        setActiveModule('auth');
      }
    } catch {
      // Ignore URL parse errors
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      if (bootstrapAbortRef.current) {
        bootstrapAbortRef.current.abort();
      }
    };
  }, []);

  // Live Match Centre automatic polling when viewing Match Centre (paused on backend errors)
  useEffect(() => {
    if (activeModule !== 'match-centre' || !autoPollEnabled || bootstrapError) return;
    const interval = setInterval(async () => {
      if (consecutivePollFailuresRef.current >= 3) return;
      try {
        const res = await apiFetch('/api/match-centre', { timeoutMs: 10000 });
        if (res.ok) {
          const mc = await res.json();
          if (mc && Array.isArray(mc.matches)) {
            consecutivePollFailuresRef.current = 0;
            setPublicData((prev: any) => ({ ...prev, matchCentre: mc, matches: mc.matches }));
          }
        } else {
          consecutivePollFailuresRef.current += 1;
        }
      } catch {
        consecutivePollFailuresRef.current += 1;
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [activeModule, autoPollEnabled, bootstrapError]);

  useEffect(() => {
    // Load existing session token if present in localStorage
    const savedSession = (() => {
      try {
        return localStorage.getItem('gs_session_token');
      } catch {
        return null;
      }
    })();
    if (savedSession) {
      loadUserDashboard(savedSession);
    }

    const unsubscribe = onAuthStateChanged(auth, async (usr) => {
      setFirebaseUser(usr);
      if (usr) {
        const token = await usr.getIdToken();
        setIdToken(token);
        await loadUserDashboard(token);
      } else if (!savedSession) {
        setIdToken(null);
        setUserBundle(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handlePasswordSessionAuthenticated = async (sessionToken: string, _userProfile: any) => {
    try {
      localStorage.setItem('gs_session_token', sessionToken);
    } catch {
      // Ignore storage error
    }
    setIdToken(sessionToken);
    await loadUserDashboard(sessionToken);
    navigateToModule('dashboard');
  };

  const handleGoogleSignIn = async () => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      setIdToken(token);
      await loadUserDashboard(token);
      showToast(`Signed in as ${cred.user.displayName || cred.user.email}`);
      navigateToModule('dashboard');
    } catch (error: any) {
      showToast('Sign-in cancelled or blocked by browser popup settings.');
    }
  };

  const handleSignOut = async () => {
    try {
      if (idToken) {
        await apiFetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
        });
      }
      localStorage.removeItem('gs_session_token');
    } catch {
      // Ignore logout cleanup error
    }
    await signOut(auth).catch(() => {});
    setIdToken(null);
    setUserBundle(null);
    showToast('Signed out of Galatasaray Global Digital Platform.');
    navigateToModule('home');
  };

  const requireAuthentication = async (): Promise<string | null> => {
    if (idToken) return idToken;
    showToast('Please sign in or create an account to complete this transaction.');
    setAuthInitialMode('login');
    navigateToModule('auth');
    return null;
  };

  // Cart & Checkout Operations
  const addToCart = (prod: any, size = 'L') => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === prod.id && i.size === size);
      if (existing) {
        return prev.map((i) =>
          i.productId === prod.id && i.size === size ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: prod.id,
          name: prod.name,
          priceEur: Number(prod.priceEur),
          size,
          qty: 1,
          imageUrl: prod.imageUrl,
        },
      ];
    });
    showToast(`Added "${prod.name}" (Size ${size}) to GSStore Bag.`);
  };

  const updateCartQty = (productId: number, size: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.productId === productId && i.size === size
            ? { ...i, qty: Math.max(0, i.qty + delta) }
            : i
        )
        .filter((i) => i.qty > 0)
    );
  };

  const cartSubtotal = cart.reduce((acc, item) => acc + item.priceEur * item.qty, 0);
  const cartDiscount =
    discountCode.trim().toUpperCase() === 'CIMBOM1905' ? cartSubtotal * 0.1 : 0;
  const cartShipping =
    shippingMethod === 'Express Priority'
      ? 24
      : shippingMethod === 'Standard International'
      ? 14
      : 8;
  const cartTax = Math.max(0, cartSubtotal - cartDiscount) * 0.08;
  const cartTotal = Math.max(0, cartSubtotal - cartDiscount) + cartTax + cartShipping;

  const handleInitializeStripeIntent = async () => {
    const token = await requireAuthentication();
    if (!token) return;
    const res = await apiFetch('/api/payments/stripe/create-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amountEur: cartTotal,
        purpose: 'gsstore_checkout',
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      showToast(data.error || 'Stripe is not configured in Secrets panel.');
    } else if (data.paymentIntentId) {
      setStripePaymentIntentId(data.paymentIntentId);
      showToast(`Created Stripe PaymentIntent: ${data.paymentIntentId}`);
    }
  };

  const handleInitializePayPalOrder = async () => {
    const token = await requireAuthentication();
    if (!token) return;
    const res = await apiFetch('/api/payments/paypal/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amountEur: cartTotal,
        referenceId: `GS-BAG-${Date.now()}`,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      showToast(data.error || 'PayPal REST API is not configured in Secrets panel.');
    } else if (data.paypalOrderId) {
      setPaypalOrderIdInput(data.paypalOrderId);
      showToast(`Created PayPal Order ID: ${data.paypalOrderId}`);
    }
  };

  const handleCompleteCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await requireAuthentication();
    if (!token) return;

    const res = await apiFetch('/api/orders/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        customerName: customerName || firebaseUser?.displayName || 'Galatasaray Supporter',
        shippingAddress,
        shippingCity,
        shippingCountry,
        shippingMethod,
        paymentProvider,
        paymentIntentId: stripePaymentIntentId.trim(),
        paypalOrderId: paypalOrderIdInput.trim(),
        discountCode,
        items: cart,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setConfirmedOrder(data);
      setTrackingQuery(data.order.trackingNumber);
      await loadTrackedShipment(data.order.trackingNumber);
      await loadUserDashboard(token);
      await loadBootstrapData();
      showToast(
        `Order ${data.order.orderNumber} recorded (${data.order.status})! Tracking: ${data.order.trackingNumber}`
      );
    } else {
      showToast(data.error || 'Checkout verification failed.');
    }
  };

  const handlePurchaseMembership = async (tierCode: string) => {
    const token = await requireAuthentication();
    if (!token) return;

    const res = await apiFetch('/api/memberships/purchase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tierCode,
        paymentProvider,
        paymentIntentId: stripePaymentIntentId.trim(),
        paypalOrderId: paypalOrderIdInput.trim(),
        fullName: customerName || firebaseUser?.displayName || 'Galatasaray Member',
      }),
    });
    const data = await res.json();
    if (res.ok) {
      await loadUserDashboard(token);
      showToast(
        `Enrollment registered for ${data.tier.name} (Status: ${data.user.membershipStatus}).`
      );
      navigateToModule('dashboard');
    } else {
      showToast(data.error || 'Membership enrollment failed verification.');
    }
  };

  const handleVerifyQr = async (memberNumber: string) => {
    const res = await apiFetch(`/api/memberships/verify/${encodeURIComponent(memberNumber)}`);
    const data = await res.json();
    setQrVerificationResult(data);
  };

  const handlePlaceBid = async (auctionId: number) => {
    const token = await requireAuthentication();
    if (!token) return;

    const rawBid = bidInputs[auctionId];
    if (!rawBid) {
      showToast('Enter a valid EUR bid amount.');
      return;
    }

    const res = await apiFetch(`/api/auctions/${auctionId}/bid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        bidAmountEur: Number(rawBid),
        bidderName: customerName || firebaseUser?.displayName || 'Verified Collector',
      }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Official bid of €${Number(rawBid).toFixed(2)} confirmed!`);
      setBidInputs((prev) => ({ ...prev, [auctionId]: '' }));
      await loadBootstrapData();
      await loadUserDashboard(token);
    } else {
      showToast(data.error || 'Bid rejected.');
    }
  };

  const handleBookMeetSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await requireAuthentication();
    if (!token) return;

    const res = await apiFetch('/api/meet-bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sessionId: selectedSessionId,
        fanName: customerName || firebaseUser?.displayName || 'Galatasaray Member',
        participants: meetParticipants,
        specialRequest: meetSpecialRequest,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      showToast(`Confirmed Meet the Stars Booking! Ref: ${data.bookingReference}`);
      await loadBootstrapData();
      await loadUserDashboard(token);
    } else {
      showToast(data.error || 'Booking failed.');
    }
  };

  const handleSubmitAcademyApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await requireAuthentication();
    if (!token) return;

    const res = await apiFetch('/api/academy/apply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        applicantName: acadName || firebaseUser?.displayName || 'Academy Prospect',
        dateOfBirth: acadDob,
        nationality: acadNationality,
        country: acadCountry,
        currentClub: acadClub,
        position: acadPosition,
        preferredFoot: acadFoot,
        heightCm: Number(acadHeight),
        weightKg: Number(acadWeight),
        playingLevel: 'Elite Youth Academy',
        experienceSummary: 'Competitive regional youth league starter',
        phone: acadPhone,
        highlightVideoUrl: acadVideo,
        documentCvName: 'Scouting_CV_Dossier_2026.pdf',
        personalStatement: acadStatement,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      showToast(`Academy Dossier Registered! Code: ${data.applicationCode}`);
      await loadUserDashboard(token);
    } else {
      showToast(data.error || 'Application submission failed.');
    }
  };

  const handleCreateSupportTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await requireAuthentication();
    if (!token) return;

    const res = await apiFetch('/api/support/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        requesterName: customerName || firebaseUser?.displayName || 'Supporter',
        category: supportCategory,
        subject: supportSubject,
        message: supportMessage,
        priority: 'High',
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setSupportSubject('');
      setSupportMessage('');
      showToast(`Support Ticket ${data.ticketNumber} created.`);
      await loadUserDashboard(token);
    }
  };

  const handleSubscribeNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewsletterStatus(null);
    const res = await apiFetch('/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newsletterEmail,
        supporterName: customerName || firebaseUser?.displayName || 'Global Supporter',
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewsletterEmail('');
      setNewsletterStatus('Subscribed to official RAMS Park & Florya matchday briefings.');
      showToast('Subscribed to Galatasaray SK Official Global Newsletter.');
    } else {
      setNewsletterStatus(data.error || 'Subscription failed.');
    }
  };

  // Derived Collections & Filters
  const allMatches: any[] = useMemo(
    () => publicData.matchCentre?.matches || publicData.matches || [],
    [publicData]
  );

  const liveMatch = useMemo(
    () =>
      allMatches.find((m: any) =>
        ['First Half', 'Half Time', 'Second Half', 'Extra Time', 'LIVE'].includes(m.status)
      ),
    [allMatches]
  );

  const selectedMatch = useMemo(
    () => allMatches.find((m: any) => m.id === selectedMatchId) || allMatches[0] || null,
    [allMatches, selectedMatchId]
  );

  const selectedMatchEvents = useMemo(
    () =>
      (publicData.matchCentre?.events || []).filter(
        (ev: any) => selectedMatch && ev.matchId === selectedMatch.id
      ),
    [publicData.matchCentre?.events, selectedMatch]
  );

  const selectedMatchLineups = useMemo(
    () =>
      (publicData.matchCentre?.lineups || []).filter(
        (ln: any) => selectedMatch && ln.matchId === selectedMatch.id
      ),
    [publicData.matchCentre?.lineups, selectedMatch]
  );

  const standings: any[] = publicData.matchCentre?.standings || [];

  const filteredFixtures = useMemo(() => {
    return allMatches.filter((m: any) => {
      if (fixtureStatusFilter === 'UPCOMING' && m.status !== 'Upcoming' && m.status !== 'Scheduled')
        return false;
      if (fixtureStatusFilter === 'COMPLETED' && m.status !== 'Completed' && m.status !== 'Finished')
        return false;
      if (
        fixtureCompetitionFilter !== 'ALL' &&
        !String(m.competition).toLowerCase().includes(fixtureCompetitionFilter.toLowerCase())
      )
        return false;
      if (fixtureVenueFilter === 'HOME' && !String(m.venue).toLowerCase().includes('rams park'))
        return false;
      if (fixtureVenueFilter === 'AWAY' && String(m.venue).toLowerCase().includes('rams park'))
        return false;
      return true;
    });
  }, [allMatches, fixtureStatusFilter, fixtureCompetitionFilter, fixtureVenueFilter]);

  const filteredPlayers = useMemo(() => {
    return (publicData.players || []).filter((p: any) => {
      if (squadCategoryFilter !== 'All' && p.category !== squadCategoryFilter) return false;
      if (squadPositionFilter !== 'All') {
        const pos = String(p.position || '').toLowerCase();
        if (squadPositionFilter === 'Goalkeepers' && !pos.includes('goalkeeper')) return false;
        if (
          squadPositionFilter === 'Defenders' &&
          !pos.includes('back') &&
          !pos.includes('defender')
        )
          return false;
        if (squadPositionFilter === 'Midfielders' && !pos.includes('midfield')) return false;
        if (
          squadPositionFilter === 'Forwards & Wingers' &&
          !pos.includes('winger') &&
          !pos.includes('forward')
        )
          return false;
      }
      if (
        squadSearchQuery.trim() &&
        !`${p.name} ${p.squadNumber} ${p.nationality} ${p.position}`
          .toLowerCase()
          .includes(squadSearchQuery.trim().toLowerCase())
      )
        return false;
      return true;
    });
  }, [publicData.players, squadCategoryFilter, squadPositionFilter, squadSearchQuery]);

  const publishedArticles = useMemo(() => {
    return (publicData.articles || []).filter((a: any) => {
      if (a.status && a.status !== 'Published') return false;
      if (newsCategoryFilter !== 'All' && a.category !== newsCategoryFilter) return false;
      if (
        newsSearchQuery.trim() &&
        !`${a.title} ${a.summary} ${a.category}`
          .toLowerCase()
          .includes(newsSearchQuery.trim().toLowerCase())
      )
        return false;
      return true;
    });
  }, [publicData.articles, newsCategoryFilter, newsSearchQuery]);

  const filteredProducts =
    storeCategoryFilter === 'All'
      ? publicData.products || []
      : (publicData.products || []).filter((p: any) => p.category === storeCategoryFilter);

  const clubHeadline =
    (publicData.configurations || []).find((c: any) => c.configKey === 'club_headline')
      ?.configValue || 'Sovereign Passion of Istanbul · Since 1905';

  const gatewayStatusMap: Record<string, any> = {};
  for (const item of publicData.integrationSummary || []) {
    gatewayStatusMap[item.provider] = item;
  }

  return (
    <div className="min-h-screen bg-[#07080C] text-[#F8FAFC] flex flex-col selection:bg-[#A90432] selection:text-white">
      {/* Global Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-8 right-8 z-50 max-w-md rounded-2xl border border-[#FDB912]/40 bg-[#11131B]/95 backdrop-blur-xl px-6 py-4 shadow-2xl flex items-center gap-3.5"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="w-5 h-5 text-[#FDB912] shrink-0" />
            <p className="text-sm font-medium text-white">{toastMessage}</p>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-[#94A3B8] hover:text-white ml-auto"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Live Matchday & Sovereign Identity Bar */}
      <div className="border-b border-[#1E2231] bg-[#0B0D14] px-4 sm:px-8 py-2.5 text-xs">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {liveMatch ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedMatchId(liveMatch.id);
                  navigateToModule('match-centre');
                }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#A90432] text-white font-mono font-bold uppercase tracking-wider animate-pulse"
              >
                <span className="w-2 h-2 rounded-full bg-[#FDB912]" /> LIVE: GALATASARAY{' '}
                {liveMatch.homeScore ?? 0} - {liveMatch.awayScore ?? 0} {liveMatch.opponent} (
                {liveMatch.matchMinute || 67}&apos;)
              </button>
            ) : (
              <span className="inline-flex items-center gap-2 font-mono uppercase tracking-widest text-[#FDB912]">
                <Trophy className="w-3.5 h-3.5" /> 24× Süper Lig Champions · 2000 UEFA Cup &amp;
                Super Cup Winners
              </span>
            )}
          </div>
          <div className="hidden md:flex items-center gap-6 text-[#94A3B8]">
            <button
              type="button"
              onClick={() => navigateToModule('shipping')}
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Truck className="w-3.5 h-3.5 text-[#FDB912]" /> DHL Global Air Bridge Tracker
            </button>
            <button
              type="button"
              onClick={() => navigateToModule('academy')}
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <GraduationCap className="w-3.5 h-3.5 text-[#FDB912]" /> Florya Academy Scouting
            </button>
            <button
              type="button"
              onClick={() => navigateToModule('membership')}
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Award className="w-3.5 h-3.5 text-[#FDB912]" /> 1905 Global Membership
            </button>
          </div>
        </div>
      </div>

      {/* Primary Executive Sticky Header */}
      <header className="sticky top-0 z-40 backdrop-blur-2xl bg-[#07080C]/90 border-b border-[#1E2231]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-24 flex items-center justify-between gap-6">
          {/* Brand Crest & Identity */}
          <button
            type="button"
            onClick={() => navigateToModule('home')}
            className="flex items-center gap-4 text-left group shrink-0"
          >
            <img
              src="/src/assets/images/galatasaray_logo.png"
              alt="Galatasaray SK Official Emblem"
              className="w-14 h-14 rounded-2xl object-contain bg-[#07080C] p-1 border border-[#FDB912]/40 shadow-xl shadow-[#A90432]/25"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-xl tracking-tight text-white group-hover:text-[#FDB912] transition-colors">
                  GALATASARAY SK
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#A90432]/25 text-[#FDB912] border border-[#A90432]/40">
                  1905
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] tracking-wide">
                Official Global Digital Platform
              </p>
            </div>
          </button>

          {/* Desktop Primary Navigation */}
          <nav
            className="hidden xl:flex items-center gap-1.5"
            aria-label="Primary Club Navigation"
          >
            {[
              { id: 'home', label: 'Home' },
              { id: 'match-centre', label: 'Match Centre', badge: liveMatch ? 'LIVE' : undefined },
              { id: 'fixtures', label: 'Fixtures & Results' },
              { id: 'squad', label: 'Squad' },
              { id: 'news', label: 'News & Media' },
              { id: 'statistics', label: 'Statistics' },
              { id: 'store', label: `Shop (${cart.reduce((a, b) => a + b.qty, 0)})` },
              { id: 'auctions', label: 'Auctions' },
              { id: 'meet', label: 'Tickets & VIP' },
              ...(userBundle?.profile?.role === 'ADMIN'
                ? [{ id: 'admin', label: 'Admin' }]
                : []),
            ].map((item) => {
              const active = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateToModule(item.id as ActiveModule)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all flex items-center gap-2 ${
                    active
                      ? 'bg-[#A90432] text-white shadow-lg shadow-[#A90432]/25'
                      : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 rounded bg-[#FDB912] text-[#07080C] font-mono text-[10px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Search, Supporter Hub & Mobile Trigger */}
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                placeholder="Search players, fixtures, store..."
                aria-label="Search players, fixtures, store, and news"
                className="w-52 lg:w-64 rounded-xl border border-[#232736] bg-[#11131B] pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#FDB912]"
              />
            </div>

            {idToken ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateToModule('dashboard')}
                  className="px-4 py-2.5 rounded-xl border border-[#232736] bg-[#11131B] hover:border-[#FDB912]/50 text-xs font-semibold text-white flex items-center gap-2"
                >
                  <UserCheck className="w-4 h-4 text-[#FDB912]" />
                  <span className="hidden sm:inline">
                    {userBundle?.profile?.fullName || firebaseUser?.displayName || 'Supporter Hub'}
                  </span>
                  {userBundle?.profile?.role === 'ADMIN' && (
                    <span className="px-1.5 py-0.5 rounded bg-[#A90432] text-[10px] font-mono text-white">
                      ADMIN
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="p-2.5 rounded-xl border border-[#232736] bg-[#11131B] text-[#94A3B8] hover:text-white"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthInitialMode('login');
                    navigateToModule('auth');
                  }}
                  className="px-4 py-2.5 rounded-xl border border-[#232736] bg-[#11131B] hover:border-[#FDB912]/50 text-xs font-semibold text-white transition-all"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthInitialMode('register');
                    navigateToModule('auth');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#A90432] to-[#8B0329] hover:from-[#8B0329] hover:to-[#A90432] text-xs font-semibold text-white shadow-lg shadow-[#A90432]/25 transition-all"
                >
                  Register
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="xl:hidden p-2.5 rounded-xl border border-[#232736] bg-[#11131B] text-white"
              aria-label="Toggle Navigation Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Dedicated Responsive Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="xl:hidden border-t border-[#1E2231] bg-[#0B0D14] px-6 py-6 space-y-4 overflow-hidden"
            >
              <div className="relative">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  placeholder="Search squad, matches, articles, store..."
                  className="w-full rounded-xl border border-[#232736] bg-[#11131B] pl-10 pr-4 py-3 text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'home', label: 'Home' },
                  { id: 'match-centre', label: 'Live Match Centre' },
                  { id: 'fixtures', label: 'Fixtures & Results' },
                  { id: 'squad', label: 'First Team Squad' },
                  { id: 'news', label: 'News & Media Hub' },
                  { id: 'statistics', label: 'Club Statistics' },
                  { id: 'store', label: 'Official GSStore' },
                  { id: 'auctions', label: 'Match-Worn Auctions' },
                  { id: 'meet', label: 'VIP & Meet the Stars' },
                  { id: 'membership', label: '1905 Membership' },
                  { id: 'academy', label: 'Florya Academy' },
                  { id: 'shipping', label: 'Global Shipping' },
                  { id: 'dashboard', label: 'Supporter Dashboard' },
                  { id: 'auth', label: 'Sign In / Register' },
                  ...(userBundle?.profile?.role === 'ADMIN'
                    ? [{ id: 'admin', label: 'Admin Console' }]
                    : []),
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateToModule(item.id as ActiveModule)}
                    className={`px-4 py-3.5 rounded-xl text-left text-xs font-semibold transition-all ${
                      activeModule === item.id
                        ? 'bg-[#A90432] text-white'
                        : 'bg-[#11131B] text-[#94A3B8] hover:text-white border border-[#232736]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Instant Global Search Results Overlay */}
      {globalSearchQuery.trim().length > 1 && (
        <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-8 pt-6">
          <div className="rounded-3xl border border-[#FDB912]/40 bg-[#11131B] p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                Global Platform Search Results for &ldquo;{globalSearchQuery}&rdquo;
              </span>
              <button
                type="button"
                onClick={() => setGlobalSearchQuery('')}
                className="text-xs text-[#94A3B8] hover:text-white"
              >
                Clear Search
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              <div className="space-y-2">
                <div className="font-semibold text-[#94A3B8] uppercase font-mono">Squad</div>
                {(publicData.players || [])
                  .filter((p: any) =>
                    p.name.toLowerCase().includes(globalSearchQuery.toLowerCase())
                  )
                  .map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPlayer(p);
                        navigateToModule('squad');
                        setGlobalSearchQuery('');
                      }}
                      className="block w-full text-left p-3 rounded-xl bg-[#07080C] hover:bg-white/5 text-white font-medium"
                    >
                      #{p.squadNumber} {p.name} ({p.position})
                    </button>
                  ))}
              </div>
              <div className="space-y-2">
                <div className="font-semibold text-[#94A3B8] uppercase font-mono">GSStore</div>
                {(publicData.products || [])
                  .filter((pr: any) =>
                    pr.name.toLowerCase().includes(globalSearchQuery.toLowerCase())
                  )
                  .map((pr: any) => (
                    <button
                      key={pr.id}
                      type="button"
                      onClick={() => {
                        navigateToModule('store');
                        setGlobalSearchQuery('');
                      }}
                      className="block w-full text-left p-3 rounded-xl bg-[#07080C] hover:bg-white/5 text-white font-medium"
                    >
                      {pr.name} — €{pr.priceEur}
                    </button>
                  ))}
              </div>
              <div className="space-y-2">
                <div className="font-semibold text-[#94A3B8] uppercase font-mono">
                  Fixtures &amp; Editorial
                </div>
                {allMatches
                  .filter((m: any) =>
                    m.opponent.toLowerCase().includes(globalSearchQuery.toLowerCase())
                  )
                  .map((m: any) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedMatchId(m.id);
                        navigateToModule('match-centre');
                        setGlobalSearchQuery('');
                      }}
                      className="block w-full text-left p-3 rounded-xl bg-[#07080C] hover:bg-white/5 text-white font-medium"
                    >
                      Galatasaray vs {m.opponent} ({m.matchDate})
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container with Expansive Breathing Room */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-12 sm:py-16">
        {loadingPublic ? (
          <div className="space-y-12 py-12" aria-busy="true">
            <div className="h-[480px] rounded-[36px] bg-[#11131B] animate-pulse border border-[#232736]" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="h-64 rounded-3xl bg-[#11131B] animate-pulse border border-[#232736]" />
              <div className="h-64 rounded-3xl bg-[#11131B] animate-pulse border border-[#232736]" />
              <div className="h-64 rounded-3xl bg-[#11131B] animate-pulse border border-[#232736]" />
            </div>
          </div>
        ) : bootstrapError ? (
          <div className="rounded-3xl border border-[#EF4444]/40 bg-[#11131B] p-10 sm:p-12 text-center space-y-6 max-w-2xl mx-auto">
            <AlertCircle className="w-12 h-12 text-[#EF4444] mx-auto" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">{bootstrapError}</h2>
              {telemetryDiagnostic && (
                <p className="text-xs text-[#94A3B8] max-w-lg mx-auto leading-relaxed">
                  {telemetryDiagnostic.safeMessage}
                </p>
              )}
            </div>

            {telemetryDiagnostic && (
              <div className="rounded-2xl border border-[#232736] bg-[#07080C] p-4 text-left grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <span className="text-[#94A3B8]">Diagnostic Code: </span>
                  <span className="text-[#FDB912]">{telemetryDiagnostic.errorCategory}</span>
                </div>
                <div>
                  <span className="text-[#94A3B8]">HTTP Status: </span>
                  <span className="text-white">
                    {telemetryDiagnostic.httpStatus !== null
                      ? telemetryDiagnostic.httpStatus
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[#94A3B8]">Latency: </span>
                  <span className="text-white">{telemetryDiagnostic.durationMs}ms</span>
                </div>
                <div>
                  <span className="text-[#94A3B8]">Last Verified Sync: </span>
                  <span className="text-white">
                    {lastSuccessfulTelemetryAt
                      ? lastSuccessfulTelemetryAt.replace('T', ' ').slice(0, 19) + ' UTC'
                      : 'None in current session'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={retryingBootstrap}
                onClick={() => loadBootstrapData(true)}
                className="px-6 py-3 rounded-xl bg-[#A90432] hover:bg-[#8B0329] disabled:opacity-50 text-sm font-semibold text-white inline-flex items-center gap-2 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${retryingBootstrap ? 'animate-spin' : ''}`} />
                {retryingBootstrap ? 'Retrying Telemetry...' : 'Retry Connection'}
              </button>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              {/* ================================================================ */}
              {/* 1. HOME MODULE — CINEMATIC HERO & EXPANSIVE ARCHITECTURAL SCALE */}
              {/* ================================================================ */}
              {activeModule === 'home' && (
                <div className="space-y-24 sm:space-y-32">
                  {/* Cinematic Hero Section */}
                  <section className="relative rounded-[36px] overflow-hidden border border-[#232736] bg-[#11131B] min-h-[640px] lg:min-h-[720px] flex items-end shadow-2xl">
                    <img
                      src="/src/assets/images/hero_galatasaray_stadium_1791538184239.jpg"
                      alt="RAMS Park Istanbul Illuminated at Night"
                      className="absolute inset-0 w-full h-full object-cover object-center opacity-50 scale-105 transition-transform duration-1000"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#07080C] via-[#07080C]/75 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#07080C]/90 via-[#07080C]/40 to-transparent" />

                    <div className="relative z-10 w-full p-8 sm:p-14 lg:p-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
                      <div className="lg:col-span-8 space-y-6">
                        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#A90432]/30 border border-[#A90432]/60 text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                          <Sparkles className="w-3.5 h-3.5" /> {clubHeadline}
                        </div>
                        <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.04]">
                          THE SOVEREIGN PRIDE OF{' '}
                          <span className="text-[#FDB912]">ISTANBUL.</span>
                        </h1>
                        <p className="text-base sm:text-xl text-[#CBD5E1] max-w-2xl leading-relaxed">
                          Experience RAMS Park’s official digital ecosystem: real-time Match Centre
                          telemetry, First Team profiles, authenticated match-worn auctions, Florya
                          Academy scouting, and global express merchandise fulfillment.
                        </p>

                        {/* 6 Requested Hero Calls to Action */}
                        <div className="flex flex-wrap items-center gap-3.5 pt-4">
                          <button
                            type="button"
                            onClick={() => navigateToModule('match-centre')}
                            className="px-7 py-4 rounded-2xl bg-[#A90432] hover:bg-[#8B0329] text-white font-semibold text-sm shadow-xl shadow-[#A90432]/30 transition-all flex items-center gap-2.5"
                          >
                            <Activity className="w-4 h-4 text-[#FDB912]" /> Latest Match &amp; Live
                            Scores
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateToModule('fixtures')}
                            className="px-6 py-4 rounded-2xl bg-[#11131B]/90 hover:bg-[#191D2A] text-white font-semibold text-sm border border-[#232736] transition-all"
                          >
                            Fixtures
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateToModule('squad')}
                            className="px-6 py-4 rounded-2xl bg-[#11131B]/90 hover:bg-[#191D2A] text-white font-semibold text-sm border border-[#232736] transition-all"
                          >
                            Squad
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateToModule('news')}
                            className="px-6 py-4 rounded-2xl bg-[#11131B]/90 hover:bg-[#191D2A] text-white font-semibold text-sm border border-[#232736] transition-all"
                          >
                            News
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateToModule('meet')}
                            className="px-6 py-4 rounded-2xl bg-[#FDB912] hover:bg-[#e5a60f] text-[#07080C] font-bold text-sm transition-all"
                          >
                            Tickets &amp; VIP
                          </button>
                        </div>
                      </div>

                      {/* Next Match Spotlight Card inside Hero */}
                      <div className="lg:col-span-4 rounded-3xl border border-white/15 bg-[#0B0D14]/90 backdrop-blur-xl p-8 space-y-5 shadow-2xl">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                            Featured Match Centre
                          </span>
                          <span className="px-2.5 py-1 rounded bg-[#A90432]/25 text-[#FDB912] font-mono text-xs">
                            {allMatches[0]?.status || 'Upcoming'}
                          </span>
                        </div>
                        <div className="text-xs text-[#94A3B8] font-mono">
                          {allMatches[0]?.competition}
                        </div>
                        <div className="py-3 border-y border-white/10 flex items-center justify-between">
                          <div>
                            <div className="text-lg font-bold text-white">Galatasaray SK</div>
                            <div className="text-lg font-bold text-[#FDB912] mt-1">
                              vs {allMatches[0]?.opponent || 'Bayern Munich'}
                            </div>
                          </div>
                          <div className="text-right font-mono">
                            {allMatches[0]?.homeScore !== null &&
                            allMatches[0]?.homeScore !== undefined ? (
                              <span className="text-3xl font-extrabold text-white">
                                {allMatches[0].homeScore} : {allMatches[0].awayScore}
                              </span>
                            ) : (
                              <span className="text-sm text-[#FDB912]">
                                {allMatches[0]?.kickoffTime}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#FDB912]" />{' '}
                            {allMatches[0]?.venue}
                          </span>
                          <span className="font-mono">{allMatches[0]?.matchDate}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (allMatches[0]) setSelectedMatchId(allMatches[0].id);
                            navigateToModule('match-centre');
                          }}
                          className="w-full py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
                        >
                          Open Full Match Centre <ArrowUpRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Interactive Fixtures & Live Score Strip */}
                  <section className="space-y-10">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                          European &amp; Domestic Campaign · 2026/27
                        </span>
                        <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mt-2">
                          Match Centre &amp; Fixtures
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateToModule('fixtures')}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[#FDB912] hover:underline"
                      >
                        Explore Complete Fixture Calendar <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {allMatches.slice(0, 3).map((m: any) => (
                        <motion.div
                          key={m.id}
                          whileHover={{ y: -6 }}
                          onClick={() => {
                            setSelectedMatchId(m.id);
                            navigateToModule('match-centre');
                          }}
                          className="cursor-pointer rounded-3xl border border-[#232736] bg-[#11131B] hover:border-[#FDB912]/50 p-8 flex flex-col justify-between space-y-6 transition-all shadow-lg"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-mono text-[#FDB912]">
                                {m.competition}
                              </span>
                              <span
                                className={`text-[11px] font-mono px-2.5 py-1 rounded ${
                                  m.status === 'Completed'
                                    ? 'bg-[#10B981]/15 text-[#10B981]'
                                    : 'bg-[#FDB912]/15 text-[#FDB912]'
                                }`}
                              >
                                {m.status}
                              </span>
                            </div>

                            <div className="py-4 border-y border-[#1E2231] space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-lg font-bold text-white">Galatasaray SK</span>
                                <span className="text-2xl font-mono font-bold text-white">
                                  {m.homeScore !== null && m.homeScore !== undefined
                                    ? m.homeScore
                                    : '-'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-lg font-bold text-[#CBD5E1]">
                                  {m.opponent}
                                </span>
                                <span className="text-2xl font-mono font-bold text-[#FDB912]">
                                  {m.awayScore !== null && m.awayScore !== undefined
                                    ? m.awayScore
                                    : '-'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                              <span>{m.venue}</span>
                              <span className="font-mono">
                                {m.matchDate} · {m.kickoffTime}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-[#FDB912] font-semibold pt-1">
                              <span>Inspect Lineups, Stats &amp; Timeline</span>
                              <ArrowUpRight className="w-4 h-4" />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </section>

                  {/* First Team Squad Spotlight */}
                  <section className="space-y-10">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                          First Team &amp; Club Icons
                        </span>
                        <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mt-2">
                          The Lions of RAMS Park
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateToModule('squad')}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[#FDB912] hover:underline"
                      >
                        View Full Squad Directory <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                      {(publicData.players || []).slice(0, 4).map((player: any) => (
                        <motion.div
                          key={player.id}
                          whileHover={{ y: -8 }}
                          onClick={() => setSelectedPlayer(player)}
                          className="group cursor-pointer rounded-3xl border border-[#232736] bg-[#11131B] overflow-hidden hover:border-[#A90432] transition-all flex flex-col justify-between shadow-xl"
                        >
                          <div className="relative aspect-[3/4] overflow-hidden bg-[#07080C]">
                            <img
                              src={player.imageUrl}
                              alt={player.name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#11131B] via-transparent to-transparent" />
                            <div className="absolute top-4 left-4 px-3.5 py-1.5 rounded-xl bg-[#07080C]/85 backdrop-blur-md border border-white/15 font-mono text-base font-bold text-[#FDB912]">
                              #{player.squadNumber}
                            </div>
                            <div className="absolute bottom-4 left-5 right-5">
                              <span className="text-xs font-mono uppercase tracking-wider text-[#FDB912]">
                                {player.position} · {player.nationality}
                              </span>
                              <h3 className="text-2xl font-bold text-white mt-0.5">
                                {player.name}
                              </h3>
                            </div>
                          </div>
                          <div className="p-6 grid grid-cols-3 gap-3 text-center border-t border-[#1E2231]">
                            <div>
                              <div className="text-[11px] text-[#94A3B8] font-mono uppercase">
                                Apps
                              </div>
                              <div className="text-lg font-mono font-bold text-white mt-0.5">
                                {player.appearances}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] text-[#94A3B8] font-mono uppercase">
                                Goals
                              </div>
                              <div className="text-lg font-mono font-bold text-[#FDB912] mt-0.5">
                                {player.goals}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] text-[#94A3B8] font-mono uppercase">
                                Assists
                              </div>
                              <div className="text-lg font-mono font-bold text-white mt-0.5">
                                {player.assists}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </section>

                  {/* Editorial Media Hub & Club Statistics Split Showcase */}
                  <section className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-7 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                            Editorial Media Hub
                          </span>
                          <h2 className="font-display text-3xl font-bold text-white mt-1">
                            Latest from Florya &amp; RAMS Park
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigateToModule('news')}
                          className="text-xs font-semibold text-[#FDB912] hover:underline"
                        >
                          All News →
                        </button>
                      </div>

                      <div className="space-y-5">
                        {publishedArticles.slice(0, 2).map((art: any) => (
                          <div
                            key={art.id}
                            onClick={() => {
                              setSelectedArticle(art);
                              navigateToModule('news');
                            }}
                            className="cursor-pointer rounded-3xl border border-[#232736] bg-[#11131B] hover:border-[#FDB912]/50 p-8 space-y-3 transition-all"
                          >
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-[#FDB912] uppercase">{art.category}</span>
                              <span className="text-[#94A3B8]">{art.publishedAt}</span>
                            </div>
                            <h3 className="text-2xl font-bold text-white">{art.title}</h3>
                            <p className="text-sm text-[#94A3B8] leading-relaxed">{art.summary}</p>
                            <div className="text-xs font-semibold text-[#FDB912] pt-2 inline-flex items-center gap-1.5">
                              Read Full Feature <ChevronRight className="w-4 h-4" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Trendyol Süper Lig Standings Snapshot */}
                    <div className="lg:col-span-5 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                            Verified Table
                          </span>
                          <h2 className="font-display text-3xl font-bold text-white mt-1">
                            League Standings
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigateToModule('statistics')}
                          className="text-xs font-semibold text-[#FDB912] hover:underline"
                        >
                          Full Analytics →
                        </button>
                      </div>

                      <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-6 overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-[#232736] text-[#94A3B8] font-mono uppercase">
                              <th className="py-3 px-2">#</th>
                              <th className="py-3 px-2">Club</th>
                              <th className="py-3 px-2 text-center">P</th>
                              <th className="py-3 px-2 text-center">GD</th>
                              <th className="py-3 px-2 text-right">PTS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1E2231]">
                            {standings.map((row: any) => (
                              <tr
                                key={row.id}
                                className={
                                  row.teamName.includes('Galatasaray')
                                    ? 'bg-[#A90432]/20 font-bold text-white'
                                    : 'text-[#CBD5E1]'
                                }
                              >
                                <td className="py-4 px-2 font-mono text-[#FDB912]">
                                  {row.position}
                                </td>
                                <td className="py-4 px-2">{row.teamName}</td>
                                <td className="py-4 px-2 text-center font-mono">{row.played}</td>
                                <td className="py-4 px-2 text-center font-mono">
                                  +{row.goalDifference}
                                </td>
                                <td className="py-4 px-2 text-right font-mono font-bold text-[#FDB912]">
                                  {row.points}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </section>

                  {/* Official Store & Match-Worn Auctions Preview */}
                  <section className="space-y-10">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                          GSStore Global &amp; Collector Vault
                        </span>
                        <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mt-2">
                          Authentic Kits &amp; Match-Worn Auctions
                        </h2>
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => navigateToModule('store')}
                          className="px-5 py-3 rounded-xl bg-[#A90432] text-xs font-semibold text-white"
                        >
                          Open GSStore
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateToModule('auctions')}
                          className="px-5 py-3 rounded-xl border border-[#232736] bg-[#11131B] text-xs font-semibold text-white hover:border-[#FDB912]"
                        >
                          Live Auctions
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {(publicData.products || []).slice(0, 3).map((prod: any) => (
                        <motion.div
                          key={prod.id}
                          whileHover={{ y: -6 }}
                          className="rounded-3xl border border-[#232736] bg-[#11131B] overflow-hidden flex flex-col justify-between p-6 space-y-5"
                        >
                          <div className="space-y-4">
                            <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#07080C]">
                              <img
                                src={prod.imageUrl}
                                alt={prod.name}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className="text-xs font-mono uppercase text-[#FDB912]">
                              {prod.category}
                            </span>
                            <h3 className="text-xl font-bold text-white">{prod.name}</h3>
                            <p className="text-xs text-[#94A3B8] line-clamp-2">
                              {prod.description}
                            </p>
                          </div>
                          <div className="pt-4 border-t border-[#1E2231] flex items-center justify-between">
                            <span className="text-2xl font-mono font-bold text-white">
                              €{prod.priceEur}
                            </span>
                            <button
                              type="button"
                              onClick={() => addToCart(prod, prod.sizes?.[0] || 'L')}
                              className="px-5 py-2.5 rounded-xl bg-[#A90432] hover:bg-[#8B0329] text-xs font-semibold text-white"
                            >
                              Add to Bag
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {/* ================================================================ */}
              {/* 2. REAL LIVE MATCH CENTRE MODULE                                 */}
              {/* ================================================================ */}
              {activeModule === 'match-centre' && (
                <div className="space-y-12">
                  {/* Provider Data Source & Honest Availability Banner */}
                  <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            publicData.matchCentre?.config?.apiKeyConfigured
                              ? 'bg-[#10B981]'
                              : 'bg-[#F59E0B]'
                          }`}
                        />
                        <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                          Data Source Telemetry ·{' '}
                          {publicData.matchCentre?.config?.providerConnectionState ||
                            'Authorized Club Database'}
                        </span>
                      </div>
                      <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
                        Galatasaray SK Official Live Match Centre
                      </h1>
                      {!publicData.matchCentre?.config?.apiKeyConfigured && (
                        <p className="text-xs text-[#94A3B8]">
                          External live provider feed (FOOTBALL_API_KEY) is not currently connected
                          in Secrets; displaying verified club database match records without
                          fabricating live scores.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setAutoPollEnabled((p) => !p)}
                        className={`px-4 py-2.5 rounded-xl border text-xs font-mono ${
                          autoPollEnabled
                            ? 'border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981]'
                            : 'border-[#232736] bg-[#07080C] text-[#94A3B8]'
                        }`}
                      >
                        Auto-Refresh (30s): {autoPollEnabled ? 'ON' : 'OFF'}
                      </button>
                      <button
                        type="button"
                        onClick={() => loadBootstrapData(true)}
                        className="px-4 py-2.5 rounded-xl bg-[#A90432] text-xs font-semibold text-white flex items-center gap-2"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh Now
                      </button>
                    </div>
                  </div>

                  {/* Match Selector Bar */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {allMatches.map((m: any) => {
                      const isSelected = selectedMatch?.id === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedMatchId(m.id)}
                          className={`text-left rounded-2xl p-6 border transition-all ${
                            isSelected
                              ? 'border-[#FDB912] bg-[#161925] shadow-xl'
                              : 'border-[#232736] bg-[#11131B] hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-mono text-[#FDB912]">
                            <span>{m.competition}</span>
                            <span>{m.status}</span>
                          </div>
                          <div className="text-lg font-bold text-white mt-2">
                            Galatasaray SK vs {m.opponent}
                          </div>
                          <div className="text-xs text-[#94A3B8] mt-1 font-mono">
                            {m.matchDate} · {m.kickoffTime}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Match Scoreboard Hero */}
                  {selectedMatch && (
                    <div className="rounded-[32px] border border-[#232736] bg-gradient-to-b from-[#151824] to-[#0D0F17] p-8 sm:p-12 space-y-10 shadow-2xl">
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
                        <div>
                          <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                            {selectedMatch.competition} · Season {selectedMatch.season || '2026/27'}
                          </span>
                          <div className="text-xs text-[#94A3B8] mt-1 flex items-center gap-3">
                            <span>Venue: {selectedMatch.venue}</span>
                            <span>·</span>
                            <span>Referee: {selectedMatch.referee || 'UEFA Official'}</span>
                            <span>·</span>
                            <span>
                              Attendance: {(selectedMatch.attendance || 52480).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <span className="px-4 py-1.5 rounded-full bg-[#A90432] text-white font-mono text-xs font-bold uppercase">
                          {selectedMatch.status}
                          {selectedMatch.matchMinute ? ` (${selectedMatch.matchMinute}')` : ''}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center text-center">
                        <div className="space-y-2">
                          <div className="w-20 h-20 rounded-3xl bg-[#A90432]/20 border border-[#A90432] flex items-center justify-center mx-auto font-display font-extrabold text-2xl text-[#FDB912]">
                            GS
                          </div>
                          <h2 className="text-2xl sm:text-3xl font-bold text-white">
                            Galatasaray SK
                          </h2>
                          <p className="text-xs font-mono text-[#94A3B8]">Home Club</p>
                        </div>

                        <div className="space-y-3">
                          {selectedMatch.homeScore !== null &&
                          selectedMatch.homeScore !== undefined ? (
                            <div className="text-5xl sm:text-7xl font-mono font-extrabold text-white tracking-tight">
                              {selectedMatch.homeScore}{' '}
                              <span className="text-[#FDB912]">:</span>{' '}
                              {selectedMatch.awayScore}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="text-3xl sm:text-4xl font-mono font-bold text-[#FDB912]">
                                {selectedMatch.kickoffTime}
                              </div>
                              <div className="text-xs font-mono uppercase text-[#94A3B8]">
                                Scheduled Kickoff · {selectedMatch.matchDate}
                              </div>
                            </div>
                          )}
                          <div className="text-xs font-mono text-[#94A3B8]">
                            Source: {selectedMatch.dataSource || 'Authorized Club Database'}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/15 flex items-center justify-center mx-auto font-display font-extrabold text-2xl text-white">
                            {selectedMatch.opponent.slice(0, 3).toUpperCase()}
                          </div>
                          <h2 className="text-2xl sm:text-3xl font-bold text-white">
                            {selectedMatch.opponent}
                          </h2>
                          <p className="text-xs font-mono text-[#94A3B8]">Visiting Club</p>
                        </div>
                      </div>

                      {/* Match Centre Sub-Tabs */}
                      <div className="flex flex-wrap gap-3 border-t border-white/10 pt-6">
                        {[
                          { id: 'overview', label: 'Match Telemetry & Key Stats' },
                          { id: 'timeline', label: `Event Timeline (${selectedMatchEvents.length})` },
                          {
                            id: 'lineups',
                            label: `Starting XI & Formation (${selectedMatchLineups.length})`,
                          },
                          { id: 'stats', label: 'Full Head-to-Head Metrics' },
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setMatchCentreTab(t.id as any)}
                            className={`px-5 py-3 rounded-xl text-xs font-semibold transition-all ${
                              matchCentreTab === t.id
                                ? 'bg-[#FDB912] text-[#07080C] font-bold'
                                : 'bg-[#07080C] text-[#94A3B8] hover:text-white border border-[#232736]'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {/* Sub-Tab 1: Overview & Stats */}
                      {(matchCentreTab === 'overview' || matchCentreTab === 'stats') && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
                          <div className="rounded-2xl border border-[#232736] bg-[#07080C] p-6 space-y-5">
                            <h3 className="text-base font-bold text-white">
                              Team Performance Telemetry
                            </h3>
                            {[
                              {
                                label: 'Ball Possession',
                                gs: selectedMatch.possessionPct || 58,
                                opp: 100 - (selectedMatch.possessionPct || 58),
                                suffix: '%',
                              },
                              {
                                label: 'Total Shots',
                                gs: selectedMatch.shotsTotal || 16,
                                opp: 9,
                                suffix: '',
                              },
                              {
                                label: 'Shots on Target',
                                gs: selectedMatch.shotsOnTarget || 8,
                                opp: 4,
                                suffix: '',
                              },
                              {
                                label: 'Corner Kicks',
                                gs: selectedMatch.corners || 7,
                                opp: 3,
                                suffix: '',
                              },
                              {
                                label: 'Fouls Committed',
                                gs: selectedMatch.fouls || 10,
                                opp: 13,
                                suffix: '',
                              },
                              {
                                label: 'Offsides',
                                gs: selectedMatch.offsides || 2,
                                opp: 3,
                                suffix: '',
                              },
                            ].map((stat) => {
                              const total = Math.max(1, stat.gs + stat.opp);
                              const gsPct = Math.round((stat.gs / total) * 100);
                              return (
                                <div key={stat.label} className="space-y-1.5">
                                  <div className="flex justify-between text-xs font-mono">
                                    <span className="text-[#FDB912] font-bold">
                                      {stat.gs}
                                      {stat.suffix}
                                    </span>
                                    <span className="text-[#94A3B8]">{stat.label}</span>
                                    <span className="text-white">
                                      {stat.opp}
                                      {stat.suffix}
                                    </span>
                                  </div>
                                  <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden flex">
                                    <div
                                      style={{ width: `${gsPct}%` }}
                                      className="bg-gradient-to-r from-[#A90432] to-[#FDB912] h-full"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="rounded-2xl border border-[#232736] bg-[#07080C] p-6 space-y-4">
                            <h3 className="text-base font-bold text-white">
                              Chronological Match Feed
                            </h3>
                            {selectedMatchEvents.length === 0 ? (
                              <p className="text-xs text-[#94A3B8]">
                                No timeline events recorded yet for this fixture. Administrators can
                                append live goals, cards, and substitutions from the Admin Console.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                {selectedMatchEvents.map((ev: any) => (
                                  <div
                                    key={ev.id}
                                    className="rounded-xl border border-[#232736] bg-[#11131B] p-4 flex items-start gap-4"
                                  >
                                    <span className="px-2.5 py-1 rounded bg-[#A90432]/25 text-[#FDB912] font-mono text-xs font-bold shrink-0">
                                      {ev.minute}&apos;
                                      {ev.addedTime ? `+${ev.addedTime}` : ''}
                                    </span>
                                    <div>
                                      <div className="text-xs font-mono uppercase text-[#FDB912]">
                                        {ev.eventType} · {ev.teamName}
                                      </div>
                                      <div className="text-sm font-bold text-white mt-0.5">
                                        {ev.playerName}{' '}
                                        {ev.assistName && (
                                          <span className="text-xs font-normal text-[#94A3B8]">
                                            (Assist: {ev.assistName})
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-[#94A3B8] mt-1">
                                        {ev.description}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Sub-Tab 2: Timeline */}
                      {matchCentreTab === 'timeline' && (
                        <div className="rounded-2xl border border-[#232736] bg-[#07080C] p-8 space-y-4">
                          <h3 className="text-lg font-bold text-white">
                            Verified Match Timeline Commentary
                          </h3>
                          {selectedMatchEvents.length === 0 ? (
                            <p className="text-sm text-[#94A3B8]">
                              Timeline events will appear here once kickoff begins.
                            </p>
                          ) : (
                            <div className="space-y-4">
                              {selectedMatchEvents.map((ev: any) => (
                                <div
                                  key={ev.id}
                                  className="rounded-2xl border border-[#232736] bg-[#11131B] p-5 flex items-center justify-between gap-4"
                                >
                                  <div className="flex items-center gap-4">
                                    <span className="text-lg font-mono font-bold text-[#FDB912]">
                                      {ev.minute}&apos;
                                    </span>
                                    <div>
                                      <div className="font-bold text-white">
                                        {ev.eventType} — {ev.playerName}
                                      </div>
                                      <div className="text-xs text-[#94A3B8]">{ev.description}</div>
                                    </div>
                                  </div>
                                  <span className="text-xs font-mono text-[#94A3B8]">
                                    {ev.teamName}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Sub-Tab 3: Starting Lineups & Tactical Pitch */}
                      {matchCentreTab === 'lineups' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                          <div className="lg:col-span-7 rounded-2xl border border-[#10B981]/30 bg-[#091914] p-8 relative min-h-[420px] flex flex-col justify-between">
                            <div className="text-xs font-mono uppercase text-[#10B981] flex justify-between">
                              <span>Galatasaray SK Tactical Pitch (4-2-3-1)</span>
                              <span>RAMS Park Turf</span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 my-auto py-6">
                              {selectedMatchLineups.map((ln: any) => (
                                <div
                                  key={ln.id}
                                  className="rounded-xl bg-[#07080C]/85 border border-white/15 p-3 text-center"
                                >
                                  <div className="text-xs font-mono text-[#FDB912] font-bold">
                                    #{ln.squadNumber} · {ln.position}
                                  </div>
                                  <div className="text-xs font-semibold text-white mt-0.5">
                                    {ln.playerName} {ln.isCaptain ? '(C)' : ''}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="lg:col-span-5 rounded-2xl border border-[#232736] bg-[#07080C] p-6 space-y-3">
                            <h3 className="text-base font-bold text-white">
                              Confirmed Starting XI
                            </h3>
                            {selectedMatchLineups.map((ln: any) => (
                              <div
                                key={ln.id}
                                className="flex items-center justify-between py-2 border-b border-white/5 text-xs"
                              >
                                <span className="font-mono text-[#FDB912] font-bold">
                                  #{ln.squadNumber}
                                </span>
                                <span className="text-white font-medium">{ln.playerName}</span>
                                <span className="font-mono text-[#94A3B8]">{ln.position}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ================================================================ */}
              {/* 3. FIXTURES & RESULTS CALENDAR MODULE                            */}
              {/* ================================================================ */}
              {activeModule === 'fixtures' && (
                <div className="space-y-12">
                  <div className="flex flex-wrap items-end justify-between gap-6">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                        2026/27 Official Schedule &amp; Results
                      </span>
                      <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mt-2">
                        Fixtures &amp; Results
                      </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {(['ALL', 'UPCOMING', 'COMPLETED'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setFixtureStatusFilter(st)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-semibold ${
                            fixtureStatusFilter === st
                              ? 'bg-[#A90432] text-white'
                              : 'bg-[#11131B] text-[#94A3B8] border border-[#232736]'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                      <select
                        value={fixtureCompetitionFilter}
                        onChange={(e) => setFixtureCompetitionFilter(e.target.value)}
                        aria-label="Filter by competition"
                        className="rounded-xl border border-[#232736] bg-[#11131B] px-4 py-2.5 text-xs text-white"
                      >
                        <option value="ALL">All Competitions</option>
                        <option value="Champions League">UEFA Champions League</option>
                        <option value="Süper Lig">Trendyol Süper Lig</option>
                      </select>
                      <select
                        value={fixtureVenueFilter}
                        onChange={(e) => setFixtureVenueFilter(e.target.value as any)}
                        aria-label="Filter by venue"
                        className="rounded-xl border border-[#232736] bg-[#11131B] px-4 py-2.5 text-xs text-white"
                      >
                        <option value="ALL">Home &amp; Away</option>
                        <option value="HOME">Home (RAMS Park)</option>
                        <option value="AWAY">Away</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {filteredFixtures.map((m: any) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedMatchId(m.id);
                          navigateToModule('match-centre');
                        }}
                        className="cursor-pointer rounded-3xl border border-[#232736] bg-[#11131B] hover:border-[#FDB912]/60 p-8 flex flex-wrap items-center justify-between gap-6 transition-all"
                      >
                        <div className="space-y-1">
                          <span className="text-xs font-mono text-[#FDB912]">{m.competition}</span>
                          <div className="text-2xl font-bold text-white">
                            Galatasaray SK vs {m.opponent}
                          </div>
                          <div className="text-xs text-[#94A3B8]">
                            {m.venue} · {m.matchDate} · {m.kickoffTime}
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          {m.homeScore !== null && m.homeScore !== undefined ? (
                            <div className="text-3xl font-mono font-extrabold text-white bg-[#07080C] px-6 py-3 rounded-2xl border border-[#232736]">
                              {m.homeScore} - {m.awayScore}
                            </div>
                          ) : (
                            <span className="px-4 py-2 rounded-xl bg-[#FDB912]/15 text-[#FDB912] font-mono text-xs font-bold">
                              {m.status}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FDB912]">
                            Match Centre <ChevronRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ================================================================ */}
              {/* 4. SQUAD & PLAYER PROFILES MODULE                                */}
              {/* ================================================================ */}
              {activeModule === 'squad' && (
                <div className="space-y-12">
                  <div className="flex flex-wrap items-end justify-between gap-6">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                        Florya Metin Oktay Roster · {(publicData.players || []).length} Official Squad Members
                      </span>
                      <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mt-2">
                        First Team Squad Directory
                      </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="search"
                        value={squadSearchQuery}
                        onChange={(e) => setSquadSearchQuery(e.target.value)}
                        placeholder="Search #number, player, or position..."
                        className="rounded-xl border border-[#232736] bg-[#11131B] px-4 py-2.5 text-xs text-white"
                      />
                      {[
                        'All',
                        'Goalkeepers',
                        'Defenders',
                        'Midfielders',
                        'Forwards & Wingers',
                      ].map((posGroup) => (
                        <button
                          key={posGroup}
                          type="button"
                          onClick={() => setSquadPositionFilter(posGroup)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-semibold ${
                            squadPositionFilter === posGroup
                              ? 'bg-[#A90432] text-white'
                              : 'bg-[#11131B] text-[#94A3B8] border border-[#232736]'
                          }`}
                        >
                          {posGroup}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                    {filteredPlayers.map((player: any) => (
                      <motion.div
                        key={player.id}
                        whileHover={{ y: -8 }}
                        onClick={() => setSelectedPlayer(player)}
                        className="cursor-pointer rounded-3xl border border-[#232736] bg-[#11131B] overflow-hidden hover:border-[#FDB912]/60 transition-all flex flex-col justify-between shadow-xl"
                      >
                        <div className="relative aspect-[3/4] bg-[#07080C] overflow-hidden">
                          <img
                            src={player.imageUrl}
                            alt={player.name}
                            loading="lazy"
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#11131B] via-transparent to-transparent" />
                          <div className="absolute top-5 left-5 px-4 py-1.5 rounded-xl bg-[#07080C]/90 border border-white/15 font-mono text-lg font-bold text-[#FDB912]">
                            #{player.squadNumber}
                          </div>
                          <div className="absolute bottom-5 left-6 right-6">
                            <span className="text-xs font-mono uppercase text-[#FDB912]">
                              {player.position} · {player.nationality}
                            </span>
                            <h3 className="text-2xl font-bold text-white mt-1">{player.name}</h3>
                          </div>
                        </div>

                        <div className="p-8 space-y-5">
                          <p className="text-xs text-[#94A3B8] line-clamp-2 leading-relaxed">
                            {player.biography}
                          </p>
                          <div className="grid grid-cols-4 gap-2 pt-4 border-t border-[#1E2231] text-center">
                            <div>
                              <div className="text-[10px] font-mono uppercase text-[#94A3B8]">
                                Apps
                              </div>
                              <div className="text-base font-mono font-bold text-white">
                                {player.appearances}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-mono uppercase text-[#94A3B8]">
                                Goals
                              </div>
                              <div className="text-base font-mono font-bold text-[#FDB912]">
                                {player.goals}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-mono uppercase text-[#94A3B8]">
                                Assists
                              </div>
                              <div className="text-base font-mono font-bold text-white">
                                {player.assists}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-mono uppercase text-[#94A3B8]">
                                Pass %
                              </div>
                              <div className="text-base font-mono font-bold text-[#10B981]">
                                {player.passAccuracy}%
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* ================================================================ */}
              {/* 5. NEWS & MEDIA HUB MODULE                                       */}
              {/* ================================================================ */}
              {activeModule === 'news' && (
                <div className="space-y-12">
                  <div className="flex flex-wrap items-end justify-between gap-6">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                        Galatasaray SK Press &amp; Broadcast Desk
                      </span>
                      <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mt-2">
                        News, Match Reports &amp; Media
                      </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="search"
                        value={newsSearchQuery}
                        onChange={(e) => setNewsSearchQuery(e.target.value)}
                        placeholder="Search headlines..."
                        className="rounded-xl border border-[#232736] bg-[#11131B] px-4 py-2.5 text-xs text-white"
                      />
                      {['All', 'News', 'Academy Announcement', 'Match Report'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setNewsCategoryFilter(cat)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-semibold ${
                            newsCategoryFilter === cat
                              ? 'bg-[#A90432] text-white'
                              : 'bg-[#11131B] text-[#94A3B8] border border-[#232736]'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedArticle && (
                    <div className="rounded-3xl border border-[#FDB912]/50 bg-[#11131B] p-8 sm:p-12 space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase text-[#FDB912]">
                          {selectedArticle.category} · {selectedArticle.publishedAt}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedArticle(null)}
                          className="text-xs text-[#94A3B8] hover:text-white"
                        >
                          Close Article ✕
                        </button>
                      </div>
                      <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
                        {selectedArticle.title}
                      </h2>
                      <p className="text-base text-[#FDB912]/90 font-medium">
                        {selectedArticle.summary}
                      </p>
                      <div className="text-base text-[#CBD5E1] leading-relaxed whitespace-pre-line pt-4 border-t border-[#232736]">
                        {selectedArticle.body}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {publishedArticles.map((art: any) => (
                      <div
                        key={art.id}
                        onClick={() => setSelectedArticle(art)}
                        className="cursor-pointer rounded-3xl border border-[#232736] bg-[#11131B] hover:border-[#FDB912]/50 p-8 sm:p-10 space-y-4 transition-all"
                      >
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-[#FDB912] uppercase">{art.category}</span>
                          <span className="text-[#94A3B8]">{art.publishedAt}</span>
                        </div>
                        <h3 className="text-2xl font-bold text-white">{art.title}</h3>
                        <p className="text-sm text-[#94A3B8] leading-relaxed">{art.summary}</p>
                        <div className="pt-3 text-xs font-semibold text-[#FDB912] inline-flex items-center gap-1.5">
                          Read Official Communiqué <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ================================================================ */}
              {/* 6. CLUB STATISTICS & ANALYTICS CENTRE                            */}
              {/* ================================================================ */}
              {activeModule === 'statistics' && (
                <div className="space-y-12">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                      Season 2026/27 · Verified Club Analytics
                    </span>
                    <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mt-2">
                      Club Statistics &amp; League Table
                    </h1>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                    {[
                      { label: 'League Position', value: '1st', sub: 'Trendyol Süper Lig' },
                      { label: 'Points Earned', value: '25', sub: '8W - 1D - 0L' },
                      { label: 'Goals Scored', value: '26', sub: '2.88 Goals / Match' },
                      { label: 'Goal Difference', value: '+19', sub: '7 Conceded' },
                      { label: 'Recent Form', value: 'W W W D W', sub: 'Unbeaten Streak' },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="rounded-3xl border border-[#232736] bg-[#11131B] p-7 space-y-2"
                      >
                        <span className="text-xs font-mono uppercase text-[#94A3B8]">
                          {card.label}
                        </span>
                        <div className="text-3xl font-mono font-extrabold text-[#FDB912]">
                          {card.value}
                        </div>
                        <div className="text-xs text-[#94A3B8]">{card.sub}</div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-8 sm:p-10 space-y-6">
                    <h2 className="text-2xl font-bold text-white">
                      2026/27 Trendyol Süper Lig Standings
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-[#232736] text-xs font-mono uppercase text-[#94A3B8]">
                            <th className="py-4 px-3">Pos</th>
                            <th className="py-4 px-3">Club</th>
                            <th className="py-4 px-3 text-center">Played</th>
                            <th className="py-4 px-3 text-center">Won</th>
                            <th className="py-4 px-3 text-center">Drawn</th>
                            <th className="py-4 px-3 text-center">Lost</th>
                            <th className="py-4 px-3 text-center">GF</th>
                            <th className="py-4 px-3 text-center">GA</th>
                            <th className="py-4 px-3 text-center">GD</th>
                            <th className="py-4 px-3 text-right">Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1E2231]">
                          {standings.map((row: any) => (
                            <tr
                              key={row.id}
                              className={
                                row.teamName.includes('Galatasaray')
                                  ? 'bg-[#A90432]/20 font-bold text-white'
                                  : 'text-[#CBD5E1]'
                              }
                            >
                              <td className="py-4 px-3 font-mono text-[#FDB912]">{row.position}</td>
                              <td className="py-4 px-3">{row.teamName}</td>
                              <td className="py-4 px-3 text-center font-mono">{row.played}</td>
                              <td className="py-4 px-3 text-center font-mono">{row.won}</td>
                              <td className="py-4 px-3 text-center font-mono">{row.drawn}</td>
                              <td className="py-4 px-3 text-center font-mono">{row.lost}</td>
                              <td className="py-4 px-3 text-center font-mono">{row.goalsFor}</td>
                              <td className="py-4 px-3 text-center font-mono">
                                {row.goalsAgainst}
                              </td>
                              <td className="py-4 px-3 text-center font-mono">
                                +{row.goalDifference}
                              </td>
                              <td className="py-4 px-3 text-right font-mono font-bold text-[#FDB912]">
                                {row.points}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ================================================================ */}
              {/* 7. OFFICIAL GSSTORE & SERVER-VERIFIED CHECKOUT                   */}
              {/* ================================================================ */}
              {activeModule === 'store' && (
                <div className="space-y-14">
                  <div className="flex flex-wrap items-end justify-between gap-6">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                        Authentic Club Merchandise · Hologram Certified
                      </span>
                      <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mt-2">
                        Official GSStore Global
                      </h1>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {['All', 'Official Jerseys', 'Signed Jerseys', 'Training Wear', 'Scarves'].map(
                        (cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setStoreCategoryFilter(cat)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-semibold ${
                              storeCategoryFilter === cat
                                ? 'bg-[#A90432] text-white'
                                : 'bg-[#11131B] text-[#94A3B8] border border-[#232736]'
                            }`}
                          >
                            {cat}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
                      {filteredProducts.map((prod: any) => (
                        <div
                          key={prod.id}
                          className="rounded-3xl border border-[#232736] bg-[#11131B] p-6 flex flex-col justify-between space-y-5"
                        >
                          <div className="space-y-4">
                            <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#07080C]">
                              <img
                                src={prod.imageUrl}
                                alt={prod.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-[#FDB912]">{prod.category}</span>
                              <span className="text-[#10B981]">In Stock ({prod.stockQuantity})</span>
                            </div>
                            <h3 className="text-xl font-bold text-white">{prod.name}</h3>
                            <p className="text-xs text-[#94A3B8] leading-relaxed">
                              {prod.description}
                            </p>
                          </div>
                          <div className="pt-4 border-t border-[#1E2231] flex items-center justify-between">
                            <span className="text-2xl font-mono font-bold text-white">
                              €{prod.priceEur}
                            </span>
                            <button
                              type="button"
                              onClick={() => addToCart(prod, prod.sizes?.[0] || 'L')}
                              className="px-5 py-3 rounded-xl bg-[#A90432] hover:bg-[#8B0329] text-xs font-semibold text-white"
                            >
                              Add to Bag
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Multi-Step Server-Verified Checkout Panel */}
                    <div className="lg:col-span-4 rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-6 h-fit">
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-[#FDB912]" /> Shopping Bag &amp;
                        Checkout
                      </h2>

                      {cart.map((item) => (
                        <div
                          key={`${item.productId}-${item.size}`}
                          className="flex items-center justify-between gap-3 py-3 border-b border-[#1E2231] text-xs"
                        >
                          <div>
                            <div className="font-bold text-white">{item.name}</div>
                            <div className="text-[#94A3B8] font-mono">
                              Size {item.size} · €{item.priceEur.toFixed(2)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.productId, item.size, -1)}
                              className="p-1.5 rounded bg-[#07080C] text-white"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-bold text-white">{item.qty}</span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.productId, item.size, 1)}
                              className="p-1.5 rounded bg-[#07080C] text-white"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}

                      <form onSubmit={handleCompleteCheckout} className="space-y-4 text-xs">
                        <input
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Full Recipient Name"
                          required
                          className="w-full rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-white"
                        />
                        <input
                          value={shippingAddress}
                          onChange={(e) => setShippingAddress(e.target.value)}
                          placeholder="Street Address"
                          required
                          className="w-full rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-white"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            value={shippingCity}
                            onChange={(e) => setShippingCity(e.target.value)}
                            placeholder="City"
                            required
                            className="w-full rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-white"
                          />
                          <input
                            value={shippingCountry}
                            onChange={(e) => setShippingCountry(e.target.value)}
                            placeholder="Country"
                            required
                            className="w-full rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[#94A3B8] mb-1">
                            Payment Gateway (Server-Side Verified)
                          </label>
                          <select
                            value={paymentProvider}
                            onChange={(e) => setPaymentProvider(e.target.value)}
                            className="w-full rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-white"
                          >
                            <option value="Bank Transfer">
                              Official Club Bank Wire (Payment Pending Verification)
                            </option>
                            <option value="Stripe">
                              Stripe PaymentIntent (Requires STRIPE_SECRET_KEY)
                            </option>
                            <option value="PayPal">
                              PayPal REST API v2 (Requires PAYPAL_CLIENT_ID)
                            </option>
                          </select>
                        </div>

                        {paymentProvider === 'Stripe' && (
                          <div className="rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-3 space-y-2">
                            <p className="text-[11px] text-[#F59E0B]">
                              Gateway Status:{' '}
                              {gatewayStatusMap.stripe?.connectionStatus || 'Configuration Warning'}
                            </p>
                            <button
                              type="button"
                              onClick={handleInitializeStripeIntent}
                              className="w-full py-2 rounded-lg bg-[#A90432] text-white font-semibold"
                            >
                              Create Server PaymentIntent
                            </button>
                            <input
                              value={stripePaymentIntentId}
                              onChange={(e) => setStripePaymentIntentId(e.target.value)}
                              placeholder="Confirmed PaymentIntent ID (pi_...)"
                              className="w-full rounded-lg border border-[#232736] bg-[#07080C] px-3 py-2 text-white font-mono"
                            />
                          </div>
                        )}

                        {paymentProvider === 'PayPal' && (
                          <div className="rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-3 space-y-2">
                            <p className="text-[11px] text-[#F59E0B]">
                              Gateway Status:{' '}
                              {gatewayStatusMap.paypal?.connectionStatus || 'Configuration Warning'}
                            </p>
                            <button
                              type="button"
                              onClick={handleInitializePayPalOrder}
                              className="w-full py-2 rounded-lg bg-[#A90432] text-white font-semibold"
                            >
                              Create PayPal Order
                            </button>
                            <input
                              value={paypalOrderIdInput}
                              onChange={(e) => setPaypalOrderIdInput(e.target.value)}
                              placeholder="Approved PayPal Order ID"
                              className="w-full rounded-lg border border-[#232736] bg-[#07080C] px-3 py-2 text-white font-mono"
                            />
                          </div>
                        )}

                        <div className="border-t border-[#1E2231] pt-3 space-y-1 font-mono">
                          <div className="flex justify-between text-[#94A3B8]">
                            <span>Subtotal</span>
                            <span>€{cartSubtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-[#94A3B8]">
                            <span>Shipping ({shippingMethod})</span>
                            <span>€{cartShipping.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-base font-bold text-[#FDB912] pt-1">
                            <span>Total</span>
                            <span>€{cartTotal.toFixed(2)}</span>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-4 rounded-xl bg-[#A90432] hover:bg-[#8B0329] text-sm font-semibold text-white"
                        >
                          Submit Verified Order
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* ================================================================ */}
              {/* 8. MATCH-WORN AUCTIONS MODULE                                    */}
              {/* ================================================================ */}
              {activeModule === 'auctions' && (
                <div className="space-y-12">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                      Tamper-Proof Hologram COA · Verified Collector Vault
                    </span>
                    <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mt-2">
                      Match-Worn &amp; Signed Auctions
                    </h1>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {(publicData.auctions || []).map((auc: any) => (
                      <div
                        key={auc.id}
                        className="rounded-3xl border border-[#232736] bg-[#11131B] overflow-hidden p-8 space-y-6"
                      >
                        <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#07080C]">
                          <img
                            src={auc.imageUrl}
                            alt={auc.itemTitle}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-[#FDB912]">COA: {auc.certificateNumber}</span>
                            <span className="text-[#10B981]">
                              {auc.status} ({auc.bidCount} Bids)
                            </span>
                          </div>
                          <h3 className="text-2xl font-bold text-white">{auc.itemTitle}</h3>
                          <p className="text-xs text-[#94A3B8]">
                            {auc.matchFixture} · {auc.competition} · {auc.itemCondition}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-[#232736] bg-[#07080C] p-5 flex items-center justify-between">
                          <div>
                            <div className="text-xs text-[#94A3B8] font-mono uppercase">
                              Current Highest Bid
                            </div>
                            <div className="text-3xl font-mono font-extrabold text-[#FDB912]">
                              €{auc.currentHighestBidEur}
                            </div>
                            <div className="text-xs text-[#94A3B8] mt-0.5">
                              Leading: {auc.highestBidderName}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={bidInputs[auc.id] || ''}
                              onChange={(e) =>
                                setBidInputs((prev) => ({ ...prev, [auc.id]: e.target.value }))
                              }
                              placeholder={`Min €${
                                Number(auc.currentHighestBidEur) + Number(auc.bidIncrementEur)
                              }`}
                              className="w-36 rounded-xl border border-[#232736] bg-[#11131B] px-3.5 py-3 text-xs font-mono text-white"
                            />
                            <button
                              type="button"
                              onClick={() => handlePlaceBid(auc.id)}
                              className="px-5 py-3 rounded-xl bg-[#A90432] hover:bg-[#8B0329] text-xs font-semibold text-white"
                            >
                              Place Bid
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ================================================================ */}
              {/* 9. VIP TICKETS & MEET THE STARS MODULE                           */}
              {/* ================================================================ */}
              {activeModule === 'meet' && (
                <div className="space-y-12">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                      RAMS Park Presidential Hospitality &amp; Florya Access
                    </span>
                    <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mt-2">
                      VIP Matchday &amp; Meet the Stars
                    </h1>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-7 space-y-6">
                      {(publicData.meetSessions || []).map((s: any) => (
                        <div
                          key={s.id}
                          onClick={() => setSelectedSessionId(s.id)}
                          className={`cursor-pointer rounded-3xl border p-8 transition-all ${
                            selectedSessionId === s.id
                              ? 'border-[#FDB912] bg-[#161925]'
                              : 'border-[#232736] bg-[#11131B]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-mono text-[#FDB912]">
                            <span>{s.sessionType}</span>
                            <span>
                              Capacity: {s.bookedCount}/{s.capacity} Booked
                            </span>
                          </div>
                          <h3 className="text-2xl font-bold text-white mt-2">{s.playerName}</h3>
                          <p className="text-xs text-[#94A3B8] mt-1">
                            {s.location} · {s.sessionDate} at {s.sessionTime}
                          </p>
                          <div className="text-2xl font-mono font-bold text-white mt-4">
                            €{s.priceEur} <span className="text-xs font-normal">/ participant</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <form
                      onSubmit={handleBookMeetSession}
                      className="lg:col-span-5 rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-5 h-fit"
                    >
                      <h2 className="text-2xl font-bold text-white">Reserve Official VIP Slot</h2>
                      <div>
                        <label className="block text-xs text-[#94A3B8] mb-1">
                          Number of Participants
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={4}
                          value={meetParticipants}
                          onChange={(e) => setMeetParticipants(Number(e.target.value))}
                          className="w-full rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#94A3B8] mb-1">
                          Personalization / Dietary / Security Notes
                        </label>
                        <textarea
                          rows={3}
                          value={meetSpecialRequest}
                          onChange={(e) => setMeetSpecialRequest(e.target.value)}
                          className="w-full rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-sm text-white"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-4 rounded-xl bg-[#A90432] hover:bg-[#8B0329] text-sm font-semibold text-white"
                      >
                        Confirm VIP Reservation
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* ================================================================ */}
              {/* 10. 1905 GLOBAL MEMBERSHIP MODULE                                */}
              {/* ================================================================ */}
              {activeModule === 'membership' && (
                <div className="space-y-12">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                      Official Digital Credential &amp; Priority Access
                    </span>
                    <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mt-2">
                      1905 Global Supporter Membership
                    </h1>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {(publicData.membershipTiers || []).map((tier: any) => (
                      <div
                        key={tier.id}
                        className="rounded-3xl border border-[#232736] bg-[#11131B] p-8 flex flex-col justify-between space-y-6"
                      >
                        <div className="space-y-4">
                          <span className="text-xs font-mono uppercase text-[#FDB912]">
                            Tier {tier.code}
                          </span>
                          <h3 className="text-2xl font-bold text-white">{tier.name}</h3>
                          <div className="text-4xl font-mono font-extrabold text-white">
                            €{tier.annualFee}
                            <span className="text-xs font-normal text-[#94A3B8]"> / year</span>
                          </div>
                          <ul className="space-y-2.5 text-xs text-[#CBD5E1] pt-2">
                            {(tier.benefits || []).map((b: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-[#FDB912] shrink-0 mt-0.5" />
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePurchaseMembership(tier.code)}
                          className="w-full py-4 rounded-xl bg-[#A90432] hover:bg-[#8B0329] text-xs font-semibold text-white"
                        >
                          Enroll in {tier.name}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ================================================================ */}
              {/* 11. FLORYA ACADEMY RECRUITMENT MODULE                            */}
              {/* ================================================================ */}
              {activeModule === 'academy' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                  <div className="lg:col-span-5 space-y-6">
                    <img
                      src="/src/assets/images/academy_training_facility_1791538234021.jpg"
                      alt="Florya Metin Oktay Academy"
                      className="w-full rounded-3xl border border-[#232736] object-cover aspect-video"
                    />
                    <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                      Florya Metin Oktay Youth Development Directorate
                    </span>
                    <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
                      International Player Scouting &amp; Trials
                    </h1>
                    <p className="text-sm text-[#94A3B8] leading-relaxed">
                      Submit your official player dossier and match highlight reel directly to our
                      UEFA Pro-licensed scouting board in Istanbul.
                    </p>
                  </div>

                  <form
                    onSubmit={handleSubmitAcademyApplication}
                    className="lg:col-span-7 rounded-3xl border border-[#232736] bg-[#11131B] p-8 sm:p-10 space-y-4"
                  >
                    <h2 className="text-2xl font-bold text-white">
                      Official Prospect Registration Form
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input
                        value={acadName}
                        onChange={(e) => setAcadName(e.target.value)}
                        placeholder="Player Full Name"
                        required
                        className="rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-sm text-white"
                      />
                      <input
                        type="date"
                        value={acadDob}
                        onChange={(e) => setAcadDob(e.target.value)}
                        required
                        className="rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-sm text-white"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <input
                        value={acadPosition}
                        onChange={(e) => setAcadPosition(e.target.value)}
                        placeholder="Primary Position"
                        className="rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-sm text-white"
                      />
                      <input
                        value={acadHeight}
                        onChange={(e) => setAcadHeight(e.target.value)}
                        placeholder="Height (cm)"
                        className="rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-sm text-white"
                      />
                      <input
                        value={acadWeight}
                        onChange={(e) => setAcadWeight(e.target.value)}
                        placeholder="Weight (kg)"
                        className="rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-sm text-white"
                      />
                    </div>
                    <textarea
                      rows={3}
                      value={acadStatement}
                      onChange={(e) => setAcadStatement(e.target.value)}
                      placeholder="Tactical strengths and career statement..."
                      className="w-full rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-sm text-white"
                    />
                    <button
                      type="submit"
                      className="w-full py-4 rounded-xl bg-[#A90432] hover:bg-[#8B0329] text-sm font-semibold text-white"
                    >
                      Submit Scouting Dossier to Florya
                    </button>
                  </form>
                </div>
              )}

              {/* ================================================================ */}
              {/* 12. GLOBAL SHIPPING TRACKER MODULE                               */}
              {/* ================================================================ */}
              {activeModule === 'shipping' && (
                <div className="space-y-10">
                  <div className="flex flex-wrap items-end justify-between gap-6">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                        Istanbul (IST) Global Logistics Hub &amp; MyDHL API
                      </span>
                      <h1 className="font-display text-4xl font-bold text-white mt-2">
                        International Shipment Telemetry
                      </h1>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        loadTrackedShipment(trackingQuery, false);
                      }}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input
                        value={trackingQuery}
                        onChange={(e) => setTrackingQuery(e.target.value)}
                        placeholder="GS-INTL-19058824TR"
                        className="rounded-xl border border-[#232736] bg-[#11131B] px-4 py-3 text-xs font-mono text-white"
                      />
                      <button
                        type="submit"
                        className="px-5 py-3 rounded-xl bg-[#A90432] text-xs font-semibold text-white"
                      >
                        Track Ledger
                      </button>
                      <button
                        type="button"
                        onClick={() => loadTrackedShipment(trackingQuery, true)}
                        className="px-5 py-3 rounded-xl border border-[#232736] bg-[#11131B] text-xs font-semibold text-[#FDB912]"
                      >
                        Query Live MyDHL API
                      </button>
                    </form>
                  </div>

                  {trackingError && (
                    <div className="rounded-2xl border border-[#EF4444]/40 bg-[#EF4444]/10 p-6 text-sm text-[#EF4444]">
                      {trackingError}
                    </div>
                  )}

                  {trackedResult && (
                    <div className="space-y-6">
                      <GlobalShippingMap
                        trackingNumber={trackedResult.shipment.trackingNumber}
                        originFacility={trackedResult.shipment.originFacility}
                        currentLocation={trackedResult.shipment.currentLocation}
                        destinationCity={trackedResult.shipment.destinationCity}
                        destinationCountry={trackedResult.shipment.destinationCountry}
                        status={trackedResult.shipment.status}
                        dataSourceMode={
                          trackedResult.shipment.dataSourceMode || 'Admin Controlled Milestone'
                        }
                        estimatedDelivery={trackedResult.shipment.estimatedDelivery}
                      />

                      <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4">
                        <h2 className="text-xl font-bold text-white">
                          Chronological Carrier Checkpoints ({trackedResult.events?.length || 0})
                        </h2>
                        <div className="space-y-3">
                          {(trackedResult.events || []).map((ev: any) => (
                            <div
                              key={ev.id}
                              className="rounded-2xl border border-[#232736] bg-[#07080C] p-5 flex flex-wrap items-center justify-between gap-4"
                            >
                              <div>
                                <div className="text-xs font-mono text-[#FDB912]">{ev.stage}</div>
                                <div className="font-bold text-white mt-0.5">{ev.facility}</div>
                                <div className="text-xs text-[#94A3B8] mt-1">{ev.description}</div>
                              </div>
                              <span className="text-xs font-mono text-[#94A3B8]">
                                {ev.eventTimestamp}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ================================================================ */}
              {/* 13. SUPPORTER DASHBOARD MODULE                                   */}
              {/* ================================================================ */}
              {activeModule === 'dashboard' && (
                <div className="space-y-10">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                        Authenticated Supporter Profile · Role:{' '}
                        {userBundle?.profile?.role || 'USER'}
                      </span>
                      <h1 className="font-display text-4xl font-bold text-white mt-1">
                        Personal Supporter Hub &amp; Digital Credentials
                      </h1>
                    </div>
                    {!idToken && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthInitialMode('login');
                          navigateToModule('auth');
                        }}
                        className="px-6 py-3 rounded-xl bg-[#A90432] text-xs font-semibold text-white"
                      >
                        Sign In / Create Account
                      </button>
                    )}
                  </div>

                  {/* Email Verification Status Reminder */}
                  {idToken && userBundle?.profile && !userBundle.profile.emailVerified && (
                    <div className="rounded-2xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-6 flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xs font-mono uppercase text-[#F59E0B] font-bold">
                          Email Verification Required
                        </div>
                        <p className="text-sm text-white">
                          Your account ({userBundle.profile.email}) is not yet verified. Verify your
                          email address to unlock store checkout, live auction bidding, and VIP
                          bookings.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthInitialMode('verify-email');
                          navigateToModule('auth');
                        }}
                        className="px-5 py-2.5 rounded-xl bg-[#FDB912] text-[#07080C] text-xs font-bold"
                      >
                        Verify Email Now
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-5">
                      <DigitalMembershipCard
                        memberName={
                          userBundle?.profile?.fullName ||
                          firebaseUser?.displayName ||
                          'Galatasaray Supporter'
                        }
                        tier={userBundle?.profile?.membershipTier || 'GOLD'}
                        memberNumber={userBundle?.profile?.membershipNumber || 'GS-1905-GLD-882410'}
                        expiryDate={userBundle?.profile?.membershipExpiry || '2027-10-09'}
                        status={userBundle?.profile?.membershipStatus || 'Active'}
                        onVerifyClick={() =>
                          handleVerifyQr(
                            userBundle?.profile?.membershipNumber || 'GS-1905-GLD-882410'
                          )
                        }
                      />
                    </div>
                    <div className="lg:col-span-7 rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-6">
                      <h2 className="text-xl font-bold text-white">
                        Submit Direct Supporter Helpdesk Ticket
                      </h2>
                      <form onSubmit={handleCreateSupportTicket} className="space-y-4">
                        <input
                          value={supportSubject}
                          onChange={(e) => setSupportSubject(e.target.value)}
                          placeholder="Subject"
                          required
                          className="w-full rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-sm text-white"
                        />
                        <textarea
                          rows={3}
                          value={supportMessage}
                          onChange={(e) => setSupportMessage(e.target.value)}
                          placeholder="How can our Member Relations team assist you?"
                          required
                          className="w-full rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-sm text-white"
                        />
                        <button
                          type="submit"
                          className="px-6 py-3 rounded-xl bg-[#A90432] text-xs font-semibold text-white"
                        >
                          Submit Support Ticket
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* ================================================================ */}
              {/* 13B. AUTHENTICATION PORTAL (REGISTER, LOGIN, VERIFY, RESET)      */}
              {/* ================================================================ */}
              {activeModule === 'auth' && (
                <AuthPortal
                  initialMode={authInitialMode}
                  initialToken={authInitialToken}
                  onAuthenticated={handlePasswordSessionAuthenticated}
                  onGoogleSignIn={handleGoogleSignIn}
                  showToast={showToast}
                />
              )}

              {/* ================================================================ */}
              {/* 14. GRANULAR ADMINISTRATOR CONTROL CENTRE                        */}
              {/* ================================================================ */}
              {activeModule === 'admin' && (
                <AdminControlCenter
                  idToken={idToken}
                  publicData={publicData}
                  onRefreshPublic={loadBootstrapData}
                  showToast={showToast}
                />
              )}

              {/* ================================================================ */}
              {/* 15. LEGAL, PRIVACY & TERMS MODULE                                */}
              {/* ================================================================ */}
              {activeModule === 'legal' && (
                <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-10 space-y-6 max-w-4xl">
                  <h1 className="font-display text-3xl font-bold text-white">
                    Galatasaray SK Legal, Privacy Policy &amp; Terms of Use
                  </h1>
                  <p className="text-sm text-[#94A3B8] leading-relaxed">
                    All payment transactions are verified server-side via Stripe and PayPal REST API
                    v2 before any order is marked as Paid. Personal supporter records and scouting
                    dossiers are encrypted and protected in compliance with KVKK and GDPR standards.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Player Detail Modal with Animated Telemetry Bars */}
      <AnimatePresence>
        {selectedPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setSelectedPlayer(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-3xl w-full rounded-3xl border border-[#232736] bg-[#11131B] p-8 sm:p-10 space-y-6 shadow-2xl"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono uppercase text-[#FDB912]">
                    #{selectedPlayer.squadNumber} · {selectedPlayer.position} ·{' '}
                    {selectedPlayer.nationality}
                  </span>
                  <h3 className="font-display text-3xl font-bold text-white mt-1">
                    {selectedPlayer.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPlayer(null)}
                  className="p-2 rounded-xl bg-white/5 text-[#94A3B8] hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-[#CBD5E1] leading-relaxed">{selectedPlayer.biography}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-2xl bg-[#07080C] p-4 border border-[#232736]">
                  <div className="text-xs text-[#94A3B8] font-mono">Appearances</div>
                  <div className="text-2xl font-mono font-bold text-white mt-1">
                    {selectedPlayer.appearances}
                  </div>
                </div>
                <div className="rounded-2xl bg-[#07080C] p-4 border border-[#232736]">
                  <div className="text-xs text-[#94A3B8] font-mono">Goals</div>
                  <div className="text-2xl font-mono font-bold text-[#FDB912] mt-1">
                    {selectedPlayer.goals}
                  </div>
                </div>
                <div className="rounded-2xl bg-[#07080C] p-4 border border-[#232736]">
                  <div className="text-xs text-[#94A3B8] font-mono">Assists</div>
                  <div className="text-2xl font-mono font-bold text-white mt-1">
                    {selectedPlayer.assists}
                  </div>
                </div>
                <div className="rounded-2xl bg-[#07080C] p-4 border border-[#232736]">
                  <div className="text-xs text-[#94A3B8] font-mono">Pass Accuracy</div>
                  <div className="text-2xl font-mono font-bold text-[#10B981] mt-1">
                    {selectedPlayer.passAccuracy}%
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Verification Modal */}
      {qrVerificationResult && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setQrVerificationResult(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4"
          >
            <h3 className="text-xl font-bold text-white">Cryptographic QR Verification</h3>
            <p className="text-sm text-[#94A3B8]">
              Status: {qrVerificationResult.verified ? 'Verified Active Member' : 'Not Found'}
            </p>
            <button
              type="button"
              onClick={() => setQrVerificationResult(null)}
              className="w-full py-3 rounded-xl bg-[#A90432] text-xs font-semibold text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Multi-Column Football Club Institution Footer */}
      <footer className="border-t border-[#1E2231] bg-[#05060A] mt-24">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-16 sm:py-20 space-y-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src="/src/assets/images/galatasaray_logo.png"
                  alt="Galatasaray SK Official Emblem"
                  className="w-12 h-12 rounded-xl object-contain bg-[#07080C] p-1 border border-[#FDB912]/40"
                />
                <span className="font-display font-extrabold text-xl text-white">
                  GALATASARAY SK
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] leading-relaxed max-w-sm">
                Founded in 1905 by Ali Sami Yen and his fellow students at Galatasaray High School.
                RAMS Park Stadium, Huzur Mahallesi, Seyrantepe, Sarıyer / Istanbul, Turkey.
              </p>
              <div className="text-xs font-mono text-[#FDB912]">
                Tel: +90 (212) 305 1905 · info@galatasaray.org
              </div>
            </div>

            <div className="lg:col-span-2 space-y-3 text-xs">
              <div className="font-mono uppercase tracking-wider text-[#FDB912] font-semibold">
                Football &amp; Club
              </div>
              <ul className="space-y-2.5 text-[#94A3B8]">
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToModule('match-centre')}
                    className="hover:text-white"
                  >
                    Live Match Centre
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToModule('fixtures')}
                    className="hover:text-white"
                  >
                    Fixtures &amp; Results
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToModule('squad')}
                    className="hover:text-white"
                  >
                    First Team Squad
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToModule('statistics')}
                    className="hover:text-white"
                  >
                    Club Statistics
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToModule('academy')}
                    className="hover:text-white"
                  >
                    Florya Academy
                  </button>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-2 space-y-3 text-xs">
              <div className="font-mono uppercase tracking-wider text-[#FDB912] font-semibold">
                Commercial &amp; VIP
              </div>
              <ul className="space-y-2.5 text-[#94A3B8]">
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToModule('store')}
                    className="hover:text-white"
                  >
                    Official GSStore
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToModule('auctions')}
                    className="hover:text-white"
                  >
                    Match-Worn Auctions
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToModule('membership')}
                    className="hover:text-white"
                  >
                    1905 Membership
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToModule('shipping')}
                    className="hover:text-white"
                  >
                    DHL Global Shipping
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToModule('legal')}
                    className="hover:text-white"
                  >
                    Privacy &amp; Legal
                  </button>
                </li>
              </ul>
            </div>

            {/* Newsletter Subscription Column */}
            <div className="lg:col-span-4 space-y-4">
              <div className="text-xs font-mono uppercase tracking-wider text-[#FDB912] font-semibold">
                Official Matchday &amp; Florya Briefing
              </div>
              <p className="text-xs text-[#94A3B8]">
                Subscribe for starting lineups, ticket priority windows, and authenticated auction
                drops.
              </p>
              <form onSubmit={handleSubscribeNewsletter} className="flex gap-2">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="supporter@example.com"
                  required
                  className="flex-1 rounded-xl border border-[#232736] bg-[#11131B] px-4 py-3 text-xs text-white"
                />
                <button
                  type="submit"
                  className="px-5 py-3 rounded-xl bg-[#A90432] hover:bg-[#8B0329] text-xs font-semibold text-white shrink-0"
                >
                  Subscribe
                </button>
              </form>
              {newsletterStatus && (
                <p className="text-xs text-[#10B981] font-mono">{newsletterStatus}</p>
              )}
            </div>
          </div>

          <div className="border-t border-[#1E2231] pt-8 flex flex-wrap items-center justify-between gap-4 text-xs text-[#94A3B8]">
            <span>
              © {new Date().getFullYear()} Galatasaray Spor Kulübü. All rights reserved.
            </span>
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => navigateToModule('legal')}
                className="hover:text-white"
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => navigateToModule('legal')}
                className="hover:text-white"
              >
                Terms of Service
              </button>
              <button
                type="button"
                onClick={() => navigateToModule('admin')}
                className="hover:text-white"
              >
                Executive Admin Console
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
