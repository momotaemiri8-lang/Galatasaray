import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  ShoppingBag,
  Gavel,
  Truck,
  GraduationCap,
  FileText,
  Settings,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  History,
  MessageSquare,
  PlugZap,
  RefreshCw,
  Mail,
  XCircle,
  Trophy,
  Activity,
  Edit3,
  EyeOff,
  Eye,
} from 'lucide-react';

interface AdminControlCenterProps {
  idToken: string | null;
  publicData: any;
  onRefreshPublic: () => void;
  showToast: (msg: string) => void;
}

export const AdminControlCenter: React.FC<AdminControlCenterProps> = ({
  idToken,
  publicData,
  onRefreshPublic,
  showToast,
}) => {
  const [activeSection, setActiveSection] = useState<
    | 'integrations'
    | 'overview'
    | 'matches'
    | 'players'
    | 'store'
    | 'auctions'
    | 'shipping'
    | 'academy'
    | 'cms'
    | 'support'
    | 'settings'
    | 'audit'
  >('integrations');

  const [adminBundle, setAdminBundle] = useState<any>(null);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [syncingFootballApi, setSyncingFootballApi] = useState<boolean>(false);
  const [smtpTestRecipient, setSmtpTestRecipient] = useState<string>('luxmartsupport@gmail.com');

  // Confirmation modal state for destructive operations
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Match Creation & Live Score Management Form
  const [matchCompetition, setMatchCompetition] = useState('Trendyol Süper Lig · Matchday 10');
  const [matchOpponent, setMatchOpponent] = useState('Trabzonspor');
  const [matchVenue, setMatchVenue] = useState('RAMS Park, Istanbul');
  const [matchDate, setMatchDate] = useState('2026-10-28');
  const [matchKickoff, setMatchKickoff] = useState('20:00 TRT');
  const [matchStatus, setMatchStatus] = useState('Upcoming');
  const [matchHomeScore, setMatchHomeScore] = useState('');
  const [matchAwayScore, setMatchAwayScore] = useState('');
  const [matchPossession, setMatchPossession] = useState('59');
  const [matchShotsTotal, setMatchShotsTotal] = useState('17');
  const [matchShotsOnTarget, setMatchShotsOnTarget] = useState('8');

  // Match Timeline Event Form
  const [eventMatchId, setEventMatchId] = useState<number>(1);
  const [eventMinute, setEventMinute] = useState('64');
  const [eventType, setEventType] = useState('GOAL');
  const [eventTeam, setEventTeam] = useState('Galatasaray SK');
  const [eventPlayer, setEventPlayer] = useState('Mauro Icardi');
  const [eventAssist, setEventAssist] = useState('Gabriel Sara');
  const [eventDescription, setEventDescription] = useState(
    'Clinical right-footed finish inside the penalty area.'
  );

  // Squad Form
  const [playerName, setPlayerName] = useState('');
  const [squadNumber, setSquadNumber] = useState('11');
  const [playerPosition, setPlayerPosition] = useState('Forward');
  const [playerCategory, setPlayerCategory] = useState('First Team');
  const [playerNationality, setPlayerNationality] = useState('Turkey');
  const [playerBio, setPlayerBio] = useState('');

  // Store Form
  const [prodSku, setProdSku] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('Official Jerseys');
  const [prodPrice, setProdPrice] = useState('129.00');
  const [prodStock, setProdStock] = useState('50');
  const [prodDesc, setProdDesc] = useState('');

  // Auction Form
  const [aucTitle, setAucTitle] = useState('');
  const [aucPlayer, setAucPlayer] = useState('');
  const [aucFixture, setAucFixture] = useState('Galatasaray vs Bayern Munich');
  const [aucStartPrice, setAucStartPrice] = useState('750.00');
  const [aucReserve, setAucReserve] = useState('1400.00');

  // Shipping Update Form
  const [trackTarget, setTrackTarget] = useState('GS-INTL-19058824TR');
  const [trackStage, setTrackStage] = useState('Customs Processing');
  const [trackFacility, setTrackFacility] = useState('London Heathrow Customs Clearance Hub, UK');
  const [trackDesc, setTrackDesc] = useState(
    'Priority commercial invoice verified; cleared for final delivery.'
  );

  // CMS Article Form
  const [cmsTitle, setCmsTitle] = useState('');
  const [cmsCategory, setCmsCategory] = useState('News');
  const [cmsStatus, setCmsStatus] = useState('Published');
  const [cmsSummary, setCmsSummary] = useState('');
  const [cmsBody, setCmsBody] = useState('');

  // Config Form
  const [configKey, setConfigKey] = useState('club_headline');
  const [configValue, setConfigValue] = useState('Sovereign Passion of Istanbul · Since 1905');

  const fetchAdminOverview = async () => {
    if (!idToken) return;
    setAccessDeniedMessage(null);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        setAccessDeniedMessage(
          errData.error ||
            'Access Denied (HTTP 403): Your account holds the standard USER role. Only accounts with the ADMIN role are authorized to access the Executive Admin Console.'
        );
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setAdminBundle(data);
        if (data.matchCentre?.matches?.length && !eventMatchId) {
          setEventMatchId(data.matchCentre.matches[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch admin overview');
    }
  };

  const handleUpdateUserSecurity = async (
    userId: number,
    updates: { role?: string; emailVerified?: boolean; accountDisabled?: boolean }
  ) => {
    if (!idToken) return;
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      showToast('User security & RBAC status updated.');
      fetchAdminOverview();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Unable to update user account.');
    }
  };

  useEffect(() => {
    fetchAdminOverview();
  }, [idToken]);

  const handleRunIntegrationTest = async (provider: string) => {
    if (!idToken) return;
    setTestingProvider(provider);
    try {
      const res = await fetch(`/api/admin/integrations/test/${provider}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          testEmailRecipient: provider === 'smtp' ? smtpTestRecipient : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.tested) {
        setAdminBundle((prev: any) => ({
          ...prev,
          integrations: data.integrations,
        }));
        showToast(`${data.tested.title}: ${data.tested.connectionStatus}`);
        onRefreshPublic();
      } else {
        showToast(data.error || 'Integration test failed.');
      }
    } catch {
      showToast('Failed to reach integration verification endpoint.');
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSyncFootballProvider = async () => {
    if (!idToken) return;
    setSyncingFootballApi(true);
    try {
      const res = await fetch('/api/admin/football-api/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (data.synced) {
        showToast('Live Football Provider synchronized with Club Database.');
      } else {
        showToast(data.error || 'Live provider unavailable; retaining verified database records.');
      }
      onRefreshPublic();
      fetchAdminOverview();
    } catch {
      showToast('Unable to reach Football API sync endpoint.');
    } finally {
      setSyncingFootballApi(false);
    }
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken || !matchOpponent) return;
    const res = await fetch('/api/admin/matches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        competition: matchCompetition,
        opponent: matchOpponent,
        venue: matchVenue,
        matchDate,
        kickoffTime: matchKickoff,
        status: matchStatus,
        homeScore: matchHomeScore,
        awayScore: matchAwayScore,
        possessionPct: Number(matchPossession),
        shotsTotal: Number(matchShotsTotal),
        shotsOnTarget: Number(matchShotsOnTarget),
      }),
    });
    if (res.ok) {
      showToast(`Fixture vs ${matchOpponent} published to Match Centre.`);
      onRefreshPublic();
      fetchAdminOverview();
    }
  };

  const handleQuickUpdateMatchStatus = async (
    matchId: number,
    status: string,
    homeScore: number | null,
    awayScore: number | null,
    matchMinute: number
  ) => {
    if (!idToken) return;
    const res = await fetch(`/api/admin/matches/${matchId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        status,
        homeScore,
        awayScore,
        matchMinute,
      }),
    });
    if (res.ok) {
      showToast(`Match #${matchId} updated to ${status}.`);
      onRefreshPublic();
      fetchAdminOverview();
    }
  };

  const handleAddMatchEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken || !eventMatchId) return;
    const res = await fetch(`/api/admin/matches/${eventMatchId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        minute: Number(eventMinute),
        eventType,
        teamName: eventTeam,
        playerName: eventPlayer,
        assistName: eventAssist,
        description: eventDescription,
      }),
    });
    if (res.ok) {
      showToast(`Timeline event (${eventMinute}' ${eventType}) recorded.`);
      onRefreshPublic();
      fetchAdminOverview();
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken || !playerName) return;
    const res = await fetch('/api/admin/players', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        name: playerName,
        squadNumber: Number(squadNumber),
        position: playerPosition,
        category: playerCategory,
        nationality: playerNationality,
        biography: playerBio,
        meetAndGreetAvailable: true,
      }),
    });
    if (res.ok) {
      setPlayerName('');
      setPlayerBio('');
      showToast('Player profile added to squad directory.');
      onRefreshPublic();
      fetchAdminOverview();
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken || !prodName) return;
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        sku: prodSku || `GS-PRO-${Math.floor(1000 + Math.random() * 9000)}`,
        name: prodName,
        category: prodCategory,
        priceEur: prodPrice,
        stockQuantity: Number(prodStock),
        description: prodDesc,
      }),
    });
    if (res.ok) {
      setProdName('');
      setProdSku('');
      setProdDesc('');
      showToast('Product published to Official GSStore catalog.');
      onRefreshPublic();
      fetchAdminOverview();
    }
  };

  const handleCreateAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken || !aucTitle) return;
    const res = await fetch('/api/admin/auctions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        itemTitle: aucTitle,
        playerName: aucPlayer,
        matchFixture: aucFixture,
        startingPriceEur: aucStartPrice,
        reservePriceEur: aucReserve,
        bidIncrementEur: '50.00',
        hoursDuration: 48,
      }),
    });
    if (res.ok) {
      setAucTitle('');
      setAucPlayer('');
      showToast('Authenticated match-worn auction lot launched.');
      onRefreshPublic();
      fetchAdminOverview();
    }
  };

  const handlePushTrackingEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken || !trackTarget) return;
    const res = await fetch(`/api/admin/shipments/${encodeURIComponent(trackTarget)}/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        stage: trackStage,
        facility: trackFacility,
        description: trackDesc,
      }),
    });
    if (res.ok) {
      showToast(`Milestone pushed to ${trackTarget} (Admin Controlled Milestone).`);
      fetchAdminOverview();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to update shipment.');
    }
  };

  const handleEvaluateApplicant = async (id: number, status: string, score: number) => {
    if (!idToken) return;
    const res = await fetch(`/api/admin/academy/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        status,
        scoutScore: score,
        assignedScout: 'Florya Technical Directorate',
      }),
    });
    if (res.ok) {
      showToast(`Academy application updated to ${status}.`);
      fetchAdminOverview();
    }
  };

  const handlePublishArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken || !cmsTitle) return;
    const res = await fetch('/api/admin/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        title: cmsTitle,
        category: cmsCategory,
        summary: cmsSummary,
        body: cmsBody,
        status: cmsStatus,
      }),
    });
    if (res.ok) {
      setCmsTitle('');
      setCmsSummary('');
      setCmsBody('');
      showToast(`Editorial story saved (${cmsStatus}).`);
      onRefreshPublic();
      fetchAdminOverview();
    }
  };

  const handleToggleArticleStatus = async (id: number, currentStatus: string) => {
    if (!idToken) return;
    const nextStatus = currentStatus === 'Published' ? 'Draft' : 'Published';
    const res = await fetch(`/api/admin/articles/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      showToast(`Article status updated to ${nextStatus}.`);
      onRefreshPublic();
      fetchAdminOverview();
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) return;
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        configKey,
        configValue,
        category: 'Brand',
      }),
    });
    if (res.ok) {
      showToast(`Platform setting "${configKey}" updated in real time.`);
      onRefreshPublic();
      fetchAdminOverview();
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    if (!idToken) return;
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      showToast(`Order #${orderId} lifecycle updated to ${status}.`);
      fetchAdminOverview();
    }
  };

  if (!idToken) {
    return (
      <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-12 text-center my-8">
        <Shield className="w-14 h-14 text-[#FDB912] mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-white mb-3">
          Super Administrator Authentication Required
        </h3>
        <p className="text-base text-[#94A3B8] max-w-lg mx-auto">
          Please sign in with an authorized Administrator account (ADMIN role) to access the
          Granular Administrator Control Centre, Live Match Telemetry, and Integration Health
          Console.
        </p>
      </div>
    );
  }

  if (accessDeniedMessage) {
    return (
      <div className="rounded-3xl border border-[#EF4444]/40 bg-[#11131B] p-12 text-center my-8 space-y-4">
        <AlertTriangle className="w-14 h-14 text-[#EF4444] mx-auto" />
        <h3 className="text-2xl font-bold text-white">
          Access Denied · Administrator Role (ADMIN) Required
        </h3>
        <p className="text-sm text-[#94A3B8] max-w-xl mx-auto leading-relaxed">
          {accessDeniedMessage}
        </p>
      </div>
    );
  }

  const integrationsList: any[] = adminBundle?.integrations || [];
  const allMatchesList: any[] =
    adminBundle?.matchCentre?.matches || publicData.matches || [];

  const renderStatusBadge = (status: string) => {
    if (status === 'Operational') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase px-3 py-1 rounded-md bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
          <CheckCircle2 className="w-3.5 h-3.5" /> Operational
        </span>
      );
    }
    if (status === 'Configuration Warning') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase px-3 py-1 rounded-md bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
          <AlertTriangle className="w-3.5 h-3.5" /> Configuration Warning
        </span>
      );
    }
    if (status === 'Connection Failed') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase px-3 py-1 rounded-md bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30">
          <XCircle className="w-3.5 h-3.5" /> Connection Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase px-3 py-1 rounded-md bg-white/10 text-[#94A3B8] border border-white/15">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-10">
      {/* Confirmation Modal for Destructive Actions */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-md w-full rounded-3xl border border-[#232736] bg-[#11131B] p-8 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-[#EF4444]">
              <AlertTriangle className="w-7 h-7 shrink-0" />
              <h4 className="text-xl font-bold text-white">{confirmDialog.title}</h4>
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed">{confirmDialog.message}</p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-5 py-2.5 rounded-xl border border-[#232736] text-sm font-semibold text-[#94A3B8] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-sm font-semibold text-white"
              >
                Confirm Permanent Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Executive Telemetry Banner */}
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-[#232736] bg-[#11131B] p-8">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
            <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
              Role-Based Access Control · Super Administrator Console
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2">
            Galatasaray SK Executive Operations & Real-Time CMS
          </h2>
          <p className="text-sm text-[#94A3B8] mt-1">
            All changes persist directly to Cloud SQL PostgreSQL and propagate immediately to the
            public platform without code edits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              fetchAdminOverview();
              onRefreshPublic();
              showToast('Synchronized live database records.');
            }}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[#232736] bg-[#161924] hover:border-[#FDB912]/50 text-xs font-semibold text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-[#FDB912]" /> Refresh Telemetry
          </button>
          <button
            type="button"
            onClick={() =>
              setConfirmDialog({
                title: 'Purge Development Seed Records?',
                message:
                  'This will permanently delete all initial sample records (is_dev_seed = true) across Players, Matches, Store, Auctions, and News while preserving your custom production records.',
                onConfirm: async () => {
                  const res = await fetch('/api/admin/dev-seed', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${idToken}` },
                  });
                  if (res.ok) {
                    showToast('Development seed records purged. Platform is now Production Clean.');
                    onRefreshPublic();
                    fetchAdminOverview();
                  }
                },
              })
            }
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-xs font-semibold text-[#EF4444] transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Purge Dev Seed Data
          </button>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="flex flex-wrap gap-2.5 border-b border-[#232736] pb-5">
        {[
          { id: 'integrations', label: 'API & Secrets Health', icon: PlugZap },
          { id: 'matches', label: 'Match Centre & Fixtures', icon: Trophy },
          { id: 'overview', label: 'Orders & Operations', icon: Shield },
          { id: 'players', label: 'Squad & Profiles', icon: Users },
          { id: 'store', label: 'GSStore Inventory', icon: ShoppingBag },
          { id: 'auctions', label: 'Match-Worn Auctions', icon: Gavel },
          { id: 'shipping', label: 'Global Logistics', icon: Truck },
          { id: 'academy', label: 'Academy Scouting', icon: GraduationCap },
          { id: 'cms', label: 'News & Media Hub', icon: FileText },
          { id: 'support', label: 'Support Desk', icon: MessageSquare },
          { id: 'settings', label: 'Platform Settings', icon: Settings },
          { id: 'audit', label: 'Audit Logs', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id as any)}
              className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                active
                  ? 'bg-[#A90432] text-white shadow-lg shadow-[#A90432]/25'
                  : 'bg-[#11131B] text-[#94A3B8] hover:text-white border border-[#232736]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 1. INTEGRATIONS & SECRETS HEALTH CONSOLE */}
      {activeSection === 'integrations' && (
        <div className="space-y-8">
          {/* Live Football Data Provider Card */}
          <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                  Live Match Telemetry & Standings Feed
                </span>
                <h3 className="text-xl font-bold text-white mt-1">
                  External Football Data Provider (API-Football v3 / Football-Data.org)
                </h3>
                <p className="text-sm text-[#94A3B8] mt-1">
                  Status:{' '}
                  <span className="text-white font-medium">
                    {adminBundle?.matchCentre?.config?.providerConnectionState ||
                      'Authorized Club Database Fallback'}
                  </span>
                </p>
              </div>
              <button
                type="button"
                disabled={syncingFootballApi}
                onClick={handleSyncFootballProvider}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#A90432] hover:bg-[#8B0329] disabled:opacity-50 text-xs font-semibold text-white transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${syncingFootballApi ? 'animate-spin' : ''}`} />
                {syncingFootballApi ? 'Syncing Provider...' : 'Sync Live Fixtures Now'}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="rounded-2xl border border-[#232736] bg-[#0B0D13] p-4">
                <div className="text-[#94A3B8] font-mono uppercase">Configured Secret</div>
                <div className="text-sm font-mono font-bold text-white mt-1">FOOTBALL_API_KEY</div>
                <div className="mt-2">
                  {adminBundle?.matchCentre?.config?.apiKeyConfigured ? (
                    <span className="text-[#10B981] font-mono">PRESENT IN SECRETS</span>
                  ) : (
                    <span className="text-[#F59E0B] font-mono">
                      MISSING (USING AUTHORIZED CLUB DB)
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-[#232736] bg-[#0B0D13] p-4">
                <div className="text-[#94A3B8] font-mono uppercase">Team & Competitions</div>
                <div className="text-sm font-mono font-bold text-white mt-1">
                  Club ID #{adminBundle?.matchCentre?.config?.teamId || '645'} · Leagues{' '}
                  {adminBundle?.matchCentre?.config?.competitionIds || '203,2'}
                </div>
                <div className="text-[#94A3B8] mt-1">
                  Süper Lig (203) & UEFA Champions League (2)
                </div>
              </div>
              <div className="rounded-2xl border border-[#232736] bg-[#0B0D13] p-4">
                <div className="text-[#94A3B8] font-mono uppercase">Last Sync Diagnostic</div>
                <div className="text-xs text-white mt-1">
                  {adminBundle?.matchCentre?.config?.lastSafeError ||
                    'No external provider errors recorded.'}
                </div>
              </div>
            </div>
          </div>

          {/* 4 Payment, Logistics & Email Integration Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {integrationsList.map((integ: any) => (
              <div
                key={integ.provider}
                className="rounded-3xl border border-[#232736] bg-[#11131B] p-8 flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-widest text-[#FDB912]">
                        Mode: {integ.environmentMode.toUpperCase()}
                      </span>
                      <h4 className="text-xl font-bold text-white mt-1">{integ.title}</h4>
                      <p className="text-xs font-mono text-[#94A3B8] mt-0.5">{integ.endpointUrl}</p>
                    </div>
                    {renderStatusBadge(integ.connectionStatus)}
                  </div>

                  {/* Environment Variable Checklist */}
                  <div className="rounded-2xl border border-[#232736] bg-[#0B0D13] p-4 space-y-2.5">
                    <div className="text-xs font-mono uppercase tracking-wider text-[#94A3B8]">
                      Required AI Studio Secrets Verification (Values Never Exposed)
                    </div>
                    {integ.variables.map((v: any) => (
                      <div
                        key={v.name}
                        className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-white/5 last:border-0"
                      >
                        <div>
                          <span className="font-mono font-semibold text-white">{v.name}</span>
                          <p className="text-[11px] text-[#94A3B8]">{v.description}</p>
                        </div>
                        {v.present ? (
                          <span className="px-2.5 py-1 rounded bg-[#10B981]/15 text-[#10B981] font-mono text-[11px] shrink-0">
                            CONFIGURED
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded bg-[#F59E0B]/15 text-[#F59E0B] font-mono text-[11px] shrink-0">
                            {v.required ? 'MISSING SECRET' : 'DEFAULT USED'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {integ.safeErrorDescription && (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 text-xs text-[#94A3B8]">
                      <span className="font-semibold text-white">Diagnostic: </span>
                      {integ.safeErrorDescription}
                    </div>
                  )}

                  {integ.provider === 'smtp' && (
                    <div className="pt-1">
                      <label className="block text-xs text-[#94A3B8] mb-1.5">
                        Test Email Recipient Address
                      </label>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-[#94A3B8]" />
                        <input
                          type="email"
                          value={smtpTestRecipient}
                          onChange={(e) => setSmtpTestRecipient(e.target.value)}
                          placeholder="admin@galatasaray.org"
                          className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-3.5 py-2 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 text-xs text-[#94A3B8]">
                    <div className="font-semibold text-white">How to Obtain Credentials:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {integ.setupInstructions.map((step: string, idx: number) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-[#FDB912] pt-1">
                      Provider Approval Note: {integ.approvalRequirement}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#232736]">
                  <div className="text-[11px] font-mono text-[#94A3B8]">
                    Last Verified: {integ.lastSuccessfulTestAt || 'Never'}
                  </div>
                  <button
                    type="button"
                    disabled={testingProvider === integ.provider}
                    onClick={() => handleRunIntegrationTest(integ.provider)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#A90432] hover:bg-[#8B0329] disabled:opacity-50 text-xs font-semibold text-white transition-colors"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        testingProvider === integ.provider ? 'animate-spin' : ''
                      }`}
                    />
                    {testingProvider === integ.provider
                      ? 'Testing Handshake...'
                      : 'Run Server Connection Test'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. MATCH CENTRE, FIXTURES & TIMELINE ADMIN */}
      {activeSection === 'matches' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleCreateMatch}
            className="lg:col-span-5 rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4"
          >
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#FDB912]" /> Create Fixture or Result
            </h3>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Competition & Round</label>
              <input
                value={matchCompetition}
                onChange={(e) => setMatchCompetition(e.target.value)}
                className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-2.5 text-sm text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Opponent Club</label>
                <input
                  value={matchOpponent}
                  onChange={(e) => setMatchOpponent(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-2.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Venue</label>
                <input
                  value={matchVenue}
                  onChange={(e) => setMatchVenue(e.target.value)}
                  className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-2.5 text-sm text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Match Date</label>
                <input
                  type="date"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-3 py-2.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Kickoff Time</label>
                <input
                  value={matchKickoff}
                  onChange={(e) => setMatchKickoff(e.target.value)}
                  className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-3 py-2.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Status</label>
                <select
                  value={matchStatus}
                  onChange={(e) => setMatchStatus(e.target.value)}
                  className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-3 py-2.5 text-sm text-white"
                >
                  <option value="Upcoming">Upcoming</option>
                  <option value="First Half">First Half (LIVE)</option>
                  <option value="Half Time">Half Time (LIVE)</option>
                  <option value="Second Half">Second Half (LIVE)</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">
                  Galatasaray Score (Leave blank if Upcoming)
                </label>
                <input
                  type="number"
                  value={matchHomeScore}
                  onChange={(e) => setMatchHomeScore(e.target.value)}
                  placeholder="-"
                  className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-2.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">
                  Opponent Score (Leave blank if Upcoming)
                </label>
                <input
                  type="number"
                  value={matchAwayScore}
                  onChange={(e) => setMatchAwayScore(e.target.value)}
                  placeholder="-"
                  className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-2.5 text-sm text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Possession %</label>
                <input
                  type="number"
                  value={matchPossession}
                  onChange={(e) => setMatchPossession(e.target.value)}
                  className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Total Shots</label>
                <input
                  type="number"
                  value={matchShotsTotal}
                  onChange={(e) => setMatchShotsTotal(e.target.value)}
                  className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">On Target</label>
                <input
                  type="number"
                  value={matchShotsOnTarget}
                  onChange={(e) => setMatchShotsOnTarget(e.target.value)}
                  className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-[#A90432] hover:bg-[#8B0329] text-sm font-semibold text-white transition-colors"
            >
              Publish Match Fixture to Match Centre
            </button>
          </form>

          <div className="lg:col-span-7 space-y-6">
            {/* Manage Existing Fixtures */}
            <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4">
              <h3 className="text-xl font-bold text-white">
                Active Fixtures & Live Score Controls ({allMatchesList.length})
              </h3>
              <div className="space-y-3">
                {allMatchesList.map((m: any) => (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-[#232736] bg-[#0B0D13] p-5 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-xs font-mono text-[#FDB912]">{m.competition}</div>
                      <div className="text-base font-bold text-white mt-0.5">
                        Galatasaray SK vs {m.opponent}{' '}
                        <span className="font-mono text-[#FDB912] ml-2">
                          {m.homeScore !== null && m.homeScore !== undefined
                            ? `${m.homeScore} - ${m.awayScore}`
                            : 'vs'}
                        </span>
                      </div>
                      <div className="text-xs text-[#94A3B8] mt-0.5">
                        {m.matchDate} · {m.kickoffTime} · {m.venue} · Status: {m.status}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickUpdateMatchStatus(
                            m.id,
                            'Second Half',
                            m.homeScore ?? 2,
                            m.awayScore ?? 1,
                            67
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-xs font-mono hover:bg-[#10B981]/25"
                      >
                        Set LIVE (67&apos;)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickUpdateMatchStatus(
                            m.id,
                            'Completed',
                            m.homeScore ?? 3,
                            m.awayScore ?? 1,
                            90
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-mono hover:bg-white/20"
                      >
                        Mark FT
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDialog({
                            title: `Delete Fixture vs ${m.opponent}?`,
                            message:
                              'Are you sure you want to permanently remove this match and its timeline events from the Match Centre?',
                            onConfirm: async () => {
                              await fetch(`/api/admin/matches/${m.id}`, {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${idToken}` },
                              });
                              showToast('Fixture deleted.');
                              onRefreshPublic();
                              fetchAdminOverview();
                            },
                          })
                        }
                        className="p-2 rounded-lg bg-[#EF4444]/15 text-[#EF4444] hover:bg-[#EF4444]/25"
                        aria-label="Delete fixture"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Append Timeline Event (Goal, Card, Substitution) */}
            <form
              onSubmit={handleAddMatchEvent}
              className="rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4"
            >
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#FDB912]" /> Push Match Timeline Event (Goals,
                Cards, Substitutions)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">Target Match</label>
                  <select
                    value={eventMatchId}
                    onChange={(e) => setEventMatchId(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-3 py-2 text-xs text-white"
                  >
                    {allMatchesList.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        vs {m.opponent} ({m.matchDate})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">Minute</label>
                  <input
                    type="number"
                    value={eventMinute}
                    onChange={(e) => setEventMinute(e.target.value)}
                    className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">Event Type</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-3 py-2 text-xs text-white"
                  >
                    <option value="GOAL">GOAL</option>
                    <option value="YELLOW CARD">YELLOW CARD</option>
                    <option value="RED CARD">RED CARD</option>
                    <option value="SUBSTITUTION">SUBSTITUTION</option>
                    <option value="VAR">VAR DECISION</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">Player Name</label>
                  <input
                    value={eventPlayer}
                    onChange={(e) => setEventPlayer(e.target.value)}
                    className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">
                    Assist / Replaced Player
                  </label>
                  <input
                    value={eventAssist}
                    onChange={(e) => setEventAssist(e.target.value)}
                    className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Commentary Description</label>
                <input
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-3 py-2 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-[#FDB912] text-[#07080C] font-bold text-xs hover:bg-[#e5a60f]"
              >
                Append Event to Match Centre
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. ORDERS & EXECUTIVE OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-6">
              <span className="text-xs font-mono uppercase text-[#94A3B8]">Registered Users</span>
              <div className="text-3xl font-bold font-mono text-white mt-2">
                {adminBundle?.users?.length || 0}
              </div>
            </div>
            <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-6">
              <span className="text-xs font-mono uppercase text-[#94A3B8]">GSStore Orders</span>
              <div className="text-3xl font-bold font-mono text-[#FDB912] mt-2">
                {adminBundle?.orders?.length || 0}
              </div>
            </div>
            <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-6">
              <span className="text-xs font-mono uppercase text-[#94A3B8]">
                Active Global Shipments
              </span>
              <div className="text-3xl font-bold font-mono text-[#10B981] mt-2">
                {adminBundle?.shipments?.length || 0}
              </div>
            </div>
            <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-6">
              <span className="text-xs font-mono uppercase text-[#94A3B8]">
                Newsletter Subscribers
              </span>
              <div className="text-3xl font-bold font-mono text-white mt-2">
                {adminBundle?.newsletterSubscribers?.length || 0}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4">
            <h3 className="text-xl font-bold text-white">Order Fulfillment & Verification Ledger</h3>
            {adminBundle?.orders?.length ? (
              <div className="space-y-3">
                {adminBundle.orders.map((o: any) => (
                  <div
                    key={o.id}
                    className="rounded-2xl border border-[#232736] bg-[#0B0D13] p-5 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">{o.orderNumber}</span>
                        <span className="text-xs px-2.5 py-0.5 rounded bg-white/10 text-[#FDB912] font-mono">
                          {o.status}
                        </span>
                      </div>
                      <div className="text-xs text-[#94A3B8] mt-1">
                        {o.customerName} ({o.customerEmail}) · €{o.totalEur} · {o.paymentProvider} ·
                        Tracking: {o.trackingNumber}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {['Processing', 'Packed', 'Shipped', 'Delivered'].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleUpdateOrderStatus(o.id, st)}
                          className="px-3 py-1.5 rounded-lg border border-[#232736] bg-[#11131B] hover:border-[#FDB912] text-xs text-white"
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#94A3B8]">No customer orders recorded yet.</p>
            )}
          </div>

          {/* Registered Users & RBAC Security Controls */}
          <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4">
            <h3 className="text-xl font-bold text-white">
              Registered User Accounts, Email Verification &amp; Role-Based Access Control (
              {adminBundle?.users?.length || 0})
            </h3>
            <div className="space-y-3">
              {(adminBundle?.users || []).map((u: any) => (
                <div
                  key={u.id}
                  className="rounded-2xl border border-[#232736] bg-[#0B0D13] p-5 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white">{u.fullName}</span>
                      <span className="font-mono text-xs text-[#94A3B8]">{u.email}</span>
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                          u.role === 'ADMIN'
                            ? 'bg-[#A90432] text-white'
                            : 'bg-white/10 text-[#94A3B8]'
                        }`}
                      >
                        {u.role}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                          u.emailVerified
                            ? 'bg-[#10B981]/15 text-[#10B981]'
                            : 'bg-[#F59E0B]/15 text-[#F59E0B]'
                        }`}
                      >
                        {u.emailVerified ? 'EMAIL VERIFIED' : 'UNVERIFIED'}
                      </span>
                      {u.accountDisabled && (
                        <span className="px-2 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444] font-mono text-[11px]">
                          DISABLED
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#94A3B8]">
                      Tier: {u.membershipTier} · Country: {u.country}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateUserSecurity(u.id, {
                          emailVerified: !u.emailVerified,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg border border-[#232736] bg-[#11131B] hover:border-[#10B981] text-xs text-white"
                    >
                      {u.emailVerified ? 'Mark Unverified' : 'Verify Email'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateUserSecurity(u.id, {
                          role: u.role === 'ADMIN' ? 'USER' : 'ADMIN',
                        })
                      }
                      className="px-3 py-1.5 rounded-lg border border-[#232736] bg-[#11131B] hover:border-[#FDB912] text-xs text-[#FDB912]"
                    >
                      {u.role === 'ADMIN' ? 'Set USER Role' : 'Grant ADMIN Role'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateUserSecurity(u.id, {
                          accountDisabled: !u.accountDisabled,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-xs text-[#EF4444]"
                    >
                      {u.accountDisabled ? 'Enable Account' : 'Disable Account'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. SQUAD MANAGEMENT */}
      {activeSection === 'players' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleAddPlayer}
            className="lg:col-span-5 rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4"
          >
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#FDB912]" /> Register Squad Member
            </h3>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Full Name (e.g. Victor Osimhen)"
              required
              className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={squadNumber}
                onChange={(e) => setSquadNumber(e.target.value)}
                placeholder="Squad #"
                className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
              />
              <input
                value={playerNationality}
                onChange={(e) => setPlayerNationality(e.target.value)}
                placeholder="Nationality"
                className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={playerPosition}
                onChange={(e) => setPlayerPosition(e.target.value)}
                className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
              >
                <option>Goalkeeper</option>
                <option>Defender</option>
                <option>Midfielder</option>
                <option>Forward</option>
                <option>Head Coach</option>
                <option>Legend</option>
              </select>
              <select
                value={playerCategory}
                onChange={(e) => setPlayerCategory(e.target.value)}
                className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
              >
                <option>First Team</option>
                <option>Coaching Staff</option>
                <option>Legends</option>
              </select>
            </div>
            <textarea
              value={playerBio}
              onChange={(e) => setPlayerBio(e.target.value)}
              rows={3}
              placeholder="Official tactical biography..."
              className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
            />
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-[#A90432] hover:bg-[#8B0329] text-sm font-semibold text-white"
            >
              Add to Official Squad Directory
            </button>
          </form>

          <div className="lg:col-span-7 rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4">
            <h3 className="text-xl font-bold text-white">
              Active Roster ({publicData.players?.length || 0})
            </h3>
            <div className="space-y-3">
              {(publicData.players || []).map((p: any) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-[#232736] bg-[#0B0D13] p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="font-bold text-white">
                      #{p.squadNumber} {p.name}
                    </div>
                    <div className="text-xs text-[#94A3B8]">
                      {p.position} · {p.category} · {p.nationality} · {p.appearances} Apps /{' '}
                      {p.goals} Goals
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmDialog({
                        title: `Remove ${p.name}?`,
                        message: `Are you sure you want to permanently delete ${p.name} from the squad database?`,
                        onConfirm: async () => {
                          await fetch(`/api/admin/players/${p.id}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${idToken}` },
                          });
                          showToast('Player removed.');
                          onRefreshPublic();
                        },
                      })
                    }
                    className="p-2 rounded-lg bg-[#EF4444]/15 text-[#EF4444] hover:bg-[#EF4444]/25"
                    aria-label="Delete player"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. GSSTORE INVENTORY */}
      {activeSection === 'store' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleAddProduct}
            className="lg:col-span-5 rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4"
          >
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#FDB912]" /> Publish Official Merchandise
            </h3>
            <input
              value={prodName}
              onChange={(e) => setProdName(e.target.value)}
              placeholder="Product Title"
              required
              className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={prodSku}
                onChange={(e) => setProdSku(e.target.value)}
                placeholder="SKU Code"
                className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
              />
              <select
                value={prodCategory}
                onChange={(e) => setProdCategory(e.target.value)}
                className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
              >
                <option>Official Jerseys</option>
                <option>Signed Jerseys</option>
                <option>Training Wear</option>
                <option>Scarves</option>
                <option>Limited Edition Items</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                step="0.01"
                value={prodPrice}
                onChange={(e) => setProdPrice(e.target.value)}
                placeholder="Price EUR"
                className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
              />
              <input
                type="number"
                value={prodStock}
                onChange={(e) => setProdStock(e.target.value)}
                placeholder="Stock Qty"
                className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
              />
            </div>
            <textarea
              value={prodDesc}
              onChange={(e) => setProdDesc(e.target.value)}
              rows={3}
              placeholder="Product specifications and authenticity details..."
              className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
            />
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-[#A90432] hover:bg-[#8B0329] text-sm font-semibold text-white"
            >
              Publish Product to GSStore
            </button>
          </form>

          <div className="lg:col-span-7 rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4">
            <h3 className="text-xl font-bold text-white">
              Catalog Inventory ({publicData.products?.length || 0})
            </h3>
            <div className="space-y-3">
              {(publicData.products || []).map((prod: any) => (
                <div
                  key={prod.id}
                  className="rounded-2xl border border-[#232736] bg-[#0B0D13] p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="font-bold text-white">{prod.name}</div>
                    <div className="text-xs text-[#94A3B8] font-mono">
                      SKU: {prod.sku} · €{prod.priceEur} · Stock: {prod.stockQuantity}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmDialog({
                        title: `Delete ${prod.name}?`,
                        message:
                          'Are you sure you want to permanently remove this product from GSStore?',
                        onConfirm: async () => {
                          await fetch(`/api/admin/products/${prod.id}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${idToken}` },
                          });
                          showToast('Product deleted.');
                          onRefreshPublic();
                        },
                      })
                    }
                    className="p-2 rounded-lg bg-[#EF4444]/15 text-[#EF4444] hover:bg-[#EF4444]/25"
                    aria-label="Delete product"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. AUCTIONS MANAGEMENT */}
      {activeSection === 'auctions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleCreateAuction}
            className="lg:col-span-5 rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4"
          >
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Gavel className="w-5 h-5 text-[#FDB912]" /> Launch Match-Worn Auction
            </h3>
            <input
              value={aucTitle}
              onChange={(e) => setAucTitle(e.target.value)}
              placeholder="Auction Lot Title"
              required
              className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
            />
            <input
              value={aucPlayer}
              onChange={(e) => setAucPlayer(e.target.value)}
              placeholder="Player Name & Number"
              required
              className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
            />
            <input
              value={aucFixture}
              onChange={(e) => setAucFixture(e.target.value)}
              placeholder="Match Fixture"
              className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={aucStartPrice}
                onChange={(e) => setAucStartPrice(e.target.value)}
                placeholder="Starting Bid EUR"
                className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
              />
              <input
                type="number"
                value={aucReserve}
                onChange={(e) => setAucReserve(e.target.value)}
                placeholder="Reserve EUR"
                className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-[#A90432] hover:bg-[#8B0329] text-sm font-semibold text-white"
            >
              Launch Authenticated Auction Lot
            </button>
          </form>

          <div className="lg:col-span-7 rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4">
            <h3 className="text-xl font-bold text-white">
              Active & Closed Auction Lots ({publicData.auctions?.length || 0})
            </h3>
            <div className="space-y-3">
              {(publicData.auctions || []).map((a: any) => (
                <div
                  key={a.id}
                  className="rounded-2xl border border-[#232736] bg-[#0B0D13] p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <div className="font-bold text-white">{a.itemTitle}</div>
                    <div className="text-xs text-[#94A3B8] font-mono">
                      COA: {a.certificateNumber} · Current High: €{a.currentHighestBidEur} (
                      {a.bidCount} bids) · Status: {a.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDialog({
                          title: `Delete Auction Lot ${a.certificateNumber}?`,
                          message:
                            'Are you sure you want to permanently remove this auction lot and its bid history?',
                          onConfirm: async () => {
                            await fetch(`/api/admin/auctions/${a.id}`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${idToken}` },
                            });
                            showToast('Auction lot deleted.');
                            onRefreshPublic();
                          },
                        })
                      }
                      className="p-2 rounded-lg bg-[#EF4444]/15 text-[#EF4444] hover:bg-[#EF4444]/25"
                      aria-label="Delete auction"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. SHIPPING & LOGISTICS */}
      {activeSection === 'shipping' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handlePushTrackingEvent}
            className="lg:col-span-5 rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4"
          >
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#FDB912]" /> Append Shipment Checkpoint
            </h3>
            <input
              value={trackTarget}
              onChange={(e) => setTrackTarget(e.target.value)}
              placeholder="Tracking Number (e.g. GS-INTL-19058824TR)"
              className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm font-mono text-white"
            />
            <select
              value={trackStage}
              onChange={(e) => setTrackStage(e.target.value)}
              className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
            >
              <option>Order Received</option>
              <option>Preparing Shipment</option>
              <option>Origin Facility</option>
              <option>International Transit</option>
              <option>Customs Processing</option>
              <option>Out for Delivery</option>
              <option>Delivered</option>
            </select>
            <input
              value={trackFacility}
              onChange={(e) => setTrackFacility(e.target.value)}
              placeholder="Logistics Facility Location"
              className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
            />
            <textarea
              value={trackDesc}
              onChange={(e) => setTrackDesc(e.target.value)}
              rows={3}
              placeholder="Checkpoint scan notes..."
              className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
            />
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-[#A90432] hover:bg-[#8B0329] text-sm font-semibold text-white"
            >
              Record Carrier Milestone
            </button>
          </form>

          <div className="lg:col-span-7 rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4">
            <h3 className="text-xl font-bold text-white">Active International Shipments</h3>
            <div className="space-y-3">
              {(adminBundle?.shipments || []).map((s: any) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-[#232736] bg-[#0B0D13] p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="font-mono font-bold text-[#FDB912]">{s.trackingNumber}</div>
                    <div className="text-xs text-white mt-0.5">
                      Recipient: {s.recipientName} → {s.destinationCity}, {s.destinationCountry}
                    </div>
                    <div className="text-xs text-[#94A3B8]">
                      Current: {s.currentLocation} ({s.status})
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTrackTarget(s.trackingNumber)}
                    className="px-3 py-1.5 rounded-lg border border-[#232736] text-xs text-white hover:border-[#FDB912]"
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 8. ACADEMY SCOUTING */}
      {activeSection === 'academy' && (
        <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4">
          <h3 className="text-xl font-bold text-white">
            Florya Youth Development Scouting Dossiers (
            {adminBundle?.academyApplications?.length || 0})
          </h3>
          <div className="space-y-4">
            {(adminBundle?.academyApplications || []).map((app: any) => (
              <div
                key={app.id}
                className="rounded-2xl border border-[#232736] bg-[#0B0D13] p-6 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#FDB912]">{app.applicationCode}</span>
                    <span className="font-bold text-white text-base">{app.applicantName}</span>
                    <span className="px-2.5 py-0.5 rounded bg-white/10 text-xs font-mono text-white">
                      {app.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#94A3B8]">
                    DOB: {app.dateOfBirth} · {app.position} · Foot: {app.preferredFoot} ·{' '}
                    {app.heightCm}cm / {app.weightKg}kg · Current Club: {app.currentClub}
                  </p>
                  <p className="text-xs text-white/80 italic">&ldquo;{app.personalStatement}&rdquo;</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEvaluateApplicant(app.id, 'Shortlisted', 90)}
                    className="px-3.5 py-2 rounded-xl bg-[#10B981]/15 text-[#10B981] text-xs font-semibold"
                  >
                    Shortlist (90)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEvaluateApplicant(app.id, 'Trial Invitation', 95)}
                    className="px-3.5 py-2 rounded-xl bg-[#FDB912]/20 text-[#FDB912] text-xs font-semibold"
                  >
                    Invite to Florya Trial
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 9. CMS NEWS & MEDIA HUB */}
      {activeSection === 'cms' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handlePublishArticle}
            className="lg:col-span-5 rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4"
          >
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#FDB912]" /> Publish Editorial Story / Media
            </h3>
            <input
              value={cmsTitle}
              onChange={(e) => setCmsTitle(e.target.value)}
              placeholder="Headline Title"
              required
              className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={cmsCategory}
                onChange={(e) => setCmsCategory(e.target.value)}
                className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
              >
                <option>News</option>
                <option>Match Report</option>
                <option>Transfer News</option>
                <option>Club Announcement</option>
                <option>Exclusive Interview</option>
                <option>Video Feature</option>
                <option>Academy Announcement</option>
              </select>
              <select
                value={cmsStatus}
                onChange={(e) => setCmsStatus(e.target.value)}
                className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
              >
                <option value="Published">Published</option>
                <option value="Draft">Draft (Unpublished)</option>
                <option value="Scheduled">Scheduled</option>
              </select>
            </div>
            <input
              value={cmsSummary}
              onChange={(e) => setCmsSummary(e.target.value)}
              placeholder="Executive Deck / Summary"
              className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
            />
            <textarea
              value={cmsBody}
              onChange={(e) => setCmsBody(e.target.value)}
              rows={5}
              placeholder="Full article body copy..."
              className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
            />
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-[#A90432] hover:bg-[#8B0329] text-sm font-semibold text-white"
            >
              Save & Propagate to Media Hub
            </button>
          </form>

          <div className="lg:col-span-7 rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4">
            <h3 className="text-xl font-bold text-white">
              Published & Draft Editorial Articles ({publicData.articles?.length || 0})
            </h3>
            <div className="space-y-3">
              {(publicData.articles || []).map((art: any) => (
                <div
                  key={art.id}
                  className="rounded-2xl border border-[#232736] bg-[#0B0D13] p-5 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="max-w-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#FDB912]">{art.category}</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/10 text-white">
                        {art.status}
                      </span>
                    </div>
                    <div className="font-bold text-white mt-1">{art.title}</div>
                    <div className="text-xs text-[#94A3B8] mt-0.5">{art.publishedAt}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleArticleStatus(art.id, art.status)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#232736] text-xs text-white hover:border-[#FDB912]"
                    >
                      {art.status === 'Published' ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" /> Unpublish
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" /> Publish
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDialog({
                          title: `Delete "${art.title}"?`,
                          message: 'This editorial story will be permanently removed from the CMS.',
                          onConfirm: async () => {
                            await fetch(`/api/admin/articles/${art.id}`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${idToken}` },
                            });
                            showToast('Article deleted.');
                            onRefreshPublic();
                          },
                        })
                      }
                      className="p-2 rounded-lg bg-[#EF4444]/15 text-[#EF4444] hover:bg-[#EF4444]/25"
                      aria-label="Delete article"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 10. SUPPORT DESK */}
      {activeSection === 'support' && (
        <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4">
          <h3 className="text-xl font-bold text-white">
            Supporter Helpdesk Tickets ({adminBundle?.tickets?.length || 0})
          </h3>
          {(adminBundle?.tickets || []).length === 0 ? (
            <p className="text-sm text-[#94A3B8]">No open support tickets.</p>
          ) : (
            <div className="space-y-3">
              {(adminBundle?.tickets || []).map((t: any) => (
                <div
                  key={t.id}
                  className="rounded-2xl border border-[#232736] bg-[#0B0D13] p-5 flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <div className="font-mono text-xs text-[#FDB912]">
                      {t.ticketNumber} · {t.category} · {t.status}
                    </div>
                    <div className="font-bold text-white mt-1">{t.subject}</div>
                    <div className="text-xs text-[#94A3B8] mt-1">{t.message}</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(`/api/admin/support/${t.id}`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${idToken}`,
                        },
                        body: JSON.stringify({
                          status: 'Resolved',
                          adminReply:
                            'Resolved by Galatasaray SK Member Relations Desk. Thank you for your support.',
                        }),
                      });
                      showToast(`Ticket ${t.ticketNumber} marked Resolved.`);
                      fetchAdminOverview();
                    }}
                    className="px-4 py-2 rounded-xl bg-[#10B981]/15 text-[#10B981] text-xs font-semibold"
                  >
                    Mark Resolved
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 11. PLATFORM SETTINGS */}
      {activeSection === 'settings' && (
        <form
          onSubmit={handleSaveConfig}
          className="max-w-2xl rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4"
        >
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-[#FDB912]" /> Real-Time Platform Banner & Headline
            Configuration
          </h3>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Configuration Key</label>
            <select
              value={configKey}
              onChange={(e) => setConfigKey(e.target.value)}
              className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
            >
              <option value="club_headline">club_headline (Hero Eyebrow Tagline)</option>
              <option value="matchday_announcement">
                matchday_announcement (Global Matchday Announcement Bar)
              </option>
              <option value="primary_currency">primary_currency</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Configuration Value</label>
            <input
              value={configValue}
              onChange={(e) => setConfigValue(e.target.value)}
              className="w-full rounded-xl border border-[#232736] bg-[#0B0D13] px-4 py-3 text-sm text-white"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3.5 rounded-xl bg-[#A90432] hover:bg-[#8B0329] text-sm font-semibold text-white"
          >
            Save & Propagate Setting Immediately
          </button>
        </form>
      )}

      {/* 12. AUDIT LOGS */}
      {activeSection === 'audit' && (
        <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-8 space-y-4">
          <h3 className="text-xl font-bold text-white">Immutable Administrative Audit Trail</h3>
          <div className="space-y-2.5">
            {(adminBundle?.auditLogs || []).map((log: any) => (
              <div
                key={log.id}
                className="rounded-xl border border-[#232736] bg-[#0B0D13] p-4 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-mono text-[#FDB912]">{log.adminEmail}</span>
                  <span className="text-white font-semibold ml-2">{log.action}</span>
                  <span className="text-[#94A3B8] ml-2">({log.affectedEntity})</span>
                </div>
                <div className="font-mono text-[#94A3B8]">{log.newValue}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
