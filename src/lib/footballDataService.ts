import { db } from '../db/index.ts';
import {
  players,
  matches,
  matchEvents,
  matchLineups,
  competitionStandings,
  footballApiConfigs,
} from '../db/schema.ts';
import { eq, asc, sql } from 'drizzle-orm';
import { sanitizeProviderError } from './integrations.ts';

function isFootballApiKeyPresent(): boolean {
  const raw = process.env.FOOTBALL_API_KEY;
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase().includes('placeholder')) return false;
  return true;
}

export async function getOrCreateFootballApiConfig() {
  const rows = await db.select().from(footballApiConfigs);
  if (rows.length > 0) return rows[0];

  const inserted = await db
    .insert(footballApiConfigs)
    .values({
      provider: process.env.FOOTBALL_API_PROVIDER || 'api-football',
      baseUrl: process.env.FOOTBALL_API_BASE_URL || 'https://v3.football.api-sports.io',
      teamId: process.env.FOOTBALL_TEAM_ID || '645',
      competitionIds: process.env.FOOTBALL_COMPETITION_IDS || '203,2',
      timezone: process.env.FOOTBALL_TIMEZONE || 'Europe/Istanbul',
      pollingIntervalSec: 60,
      matchDayModeOverride: false,
    })
    .returning();

  return inserted[0];
}

export async function ensureMatchDetailsSeeded() {
  try {
    const existingStandings = await db.select().from(competitionStandings);
    if (existingStandings.length === 0) {
      await db.insert(competitionStandings).values([
        {
          competitionCode: 'SUPER_LIG',
          competitionName: 'Trendyol Süper Lig',
          season: '2026/27',
          position: 1,
          teamName: 'Galatasaray SK',
          played: 9,
          won: 8,
          drawn: 1,
          lost: 0,
          goalsFor: 26,
          goalsAgainst: 7,
          goalDifference: 19,
          points: 25,
          dataSource: 'Authorized Club Database (Dev Seed)',
          isDevSeed: true,
        },
        {
          competitionCode: 'SUPER_LIG',
          competitionName: 'Trendyol Süper Lig',
          season: '2026/27',
          position: 2,
          teamName: 'Fenerbahçe SK',
          played: 9,
          won: 6,
          drawn: 2,
          lost: 1,
          goalsFor: 20,
          goalsAgainst: 9,
          goalDifference: 11,
          points: 20,
          dataSource: 'Authorized Club Database (Dev Seed)',
          isDevSeed: true,
        },
        {
          competitionCode: 'SUPER_LIG',
          competitionName: 'Trendyol Süper Lig',
          season: '2026/27',
          position: 3,
          teamName: 'Beşiktaş JK',
          played: 9,
          won: 6,
          drawn: 1,
          lost: 2,
          goalsFor: 17,
          goalsAgainst: 10,
          goalDifference: 7,
          points: 19,
          dataSource: 'Authorized Club Database (Dev Seed)',
          isDevSeed: true,
        },
        {
          competitionCode: 'SUPER_LIG',
          competitionName: 'Trendyol Süper Lig',
          season: '2026/27',
          position: 4,
          teamName: 'Samsunspor',
          played: 9,
          won: 5,
          drawn: 2,
          lost: 2,
          goalsFor: 14,
          goalsAgainst: 11,
          goalDifference: 3,
          points: 17,
          dataSource: 'Authorized Club Database (Dev Seed)',
          isDevSeed: true,
        },
        {
          competitionCode: 'SUPER_LIG',
          competitionName: 'Trendyol Süper Lig',
          season: '2026/27',
          position: 5,
          teamName: 'Başakşehir FK',
          played: 9,
          won: 4,
          drawn: 3,
          lost: 2,
          goalsFor: 13,
          goalsAgainst: 11,
          goalDifference: 2,
          points: 15,
          dataSource: 'Authorized Club Database (Dev Seed)',
          isDevSeed: true,
        },
      ]);
    }

    const allMatches = await db.select().from(matches);
    const derbyMatch =
      allMatches.find((m) => m.opponent.includes('Fenerbahçe')) || allMatches[1] || allMatches[0];

    if (derbyMatch) {
      const existingEvents = await db
        .select()
        .from(matchEvents)
        .where(eq(matchEvents.matchId, derbyMatch.id));

      if (existingEvents.length === 0) {
        await db.insert(matchEvents).values([
          {
            matchId: derbyMatch.id,
            minute: 1,
            addedTime: 0,
            eventType: 'KICKOFF',
            teamName: 'Galatasaray SK',
            playerName: 'Match Official',
            assistName: '',
            description: 'First half underway under floodlights at RAMS Park.',
            isDevSeed: true,
          },
          {
            matchId: derbyMatch.id,
            minute: 18,
            addedTime: 0,
            eventType: 'GOAL',
            teamName: 'Galatasaray SK',
            playerName: 'Lucas Torreira',
            assistName: 'Gabriel Sara',
            description: 'Driven low volley from the edge of the penalty arc into the bottom corner.',
            isDevSeed: true,
          },
          {
            matchId: derbyMatch.id,
            minute: 29,
            addedTime: 0,
            eventType: 'GOAL',
            teamName: 'Galatasaray SK',
            playerName: 'Victor Osimhen',
            assistName: 'Yunus Akgün',
            description: 'First-time near-post finish following a rapid vertical transition.',
            isDevSeed: true,
          },
          {
            matchId: derbyMatch.id,
            minute: 45,
            addedTime: 2,
            eventType: 'HALF TIME',
            teamName: 'Galatasaray SK',
            playerName: 'Half Time Whistle',
            assistName: '',
            description: 'Galatasaray leads 2-0 at the interval.',
            isDevSeed: true,
          },
          {
            matchId: derbyMatch.id,
            minute: 61,
            addedTime: 0,
            eventType: 'GOAL',
            teamName: 'Galatasaray SK',
            playerName: 'Barış Alper Yılmaz',
            assistName: 'Lucas Torreira',
            description: 'Diagonal run in behind the defensive line finished clinically across the keeper.',
            isDevSeed: true,
          },
          {
            matchId: derbyMatch.id,
            minute: 90,
            addedTime: 4,
            eventType: 'FULL TIME',
            teamName: 'Galatasaray SK',
            playerName: 'Full Time Whistle',
            assistName: '',
            description: 'Full time at RAMS Park: Galatasaray 3 - 1 Fenerbahçe.',
            isDevSeed: true,
          },
        ]);
      }

      const existingLineups = await db
        .select()
        .from(matchLineups)
        .where(eq(matchLineups.matchId, derbyMatch.id));

      if (existingLineups.length === 0) {
        await db.insert(matchLineups).values([
          {
            matchId: derbyMatch.id,
            teamName: 'Galatasaray SK',
            formation: '4-2-3-1',
            playerName: 'Uğurcan Çakır',
            squadNumber: 1,
            position: 'GK',
            isStarter: true,
            isCaptain: true,
            pitchX: 50,
            pitchY: 90,
            isDevSeed: true,
          },
          {
            matchId: derbyMatch.id,
            teamName: 'Galatasaray SK',
            formation: '4-2-3-1',
            playerName: 'Wilfried Singo',
            squadNumber: 90,
            position: 'RB',
            isStarter: true,
            isCaptain: false,
            pitchX: 84,
            pitchY: 72,
            isDevSeed: true,
          },
          {
            matchId: derbyMatch.id,
            teamName: 'Galatasaray SK',
            formation: '4-2-3-1',
            playerName: 'Davinson Sánchez',
            squadNumber: 6,
            position: 'CB',
            isStarter: true,
            isCaptain: false,
            pitchX: 62,
            pitchY: 74,
            isDevSeed: true,
          },
          {
            matchId: derbyMatch.id,
            teamName: 'Galatasaray SK',
            formation: '4-2-3-1',
            playerName: 'Abdülkerim Bardakcı',
            squadNumber: 42,
            position: 'CB',
            isStarter: true,
            isCaptain: false,
            pitchX: 38,
            pitchY: 74,
            isDevSeed: true,
          },
          {
            matchId: derbyMatch.id,
            teamName: 'Galatasaray SK',
            formation: '4-2-3-1',
            playerName: 'Ismail Jakobs',
            squadNumber: 4,
            position: 'LB',
            isStarter: true,
            isCaptain: false,
            pitchX: 16,
            pitchY: 72,
            isDevSeed: true,
          },
          {
            matchId: derbyMatch.id,
            teamName: 'Galatasaray SK',
            formation: '4-2-3-1',
            playerName: 'Lucas Torreira',
            squadNumber: 34,
            position: 'CDM',
            isStarter: true,
            isCaptain: false,
            pitchX: 60,
            pitchY: 54,
            isDevSeed: true,
          },
          {
            matchId: derbyMatch.id,
            teamName: 'Galatasaray SK',
            formation: '4-2-3-1',
            playerName: 'Gabriel Sara',
            squadNumber: 8,
            position: 'CM',
            isStarter: true,
            isCaptain: false,
            pitchX: 40,
            pitchY: 54,
            isDevSeed: true,
          },
          {
            matchId: derbyMatch.id,
            teamName: 'Galatasaray SK',
            formation: '4-2-3-1',
            playerName: 'Leroy Sané',
            squadNumber: 10,
            position: 'RW',
            isStarter: true,
            isCaptain: false,
            pitchX: 82,
            pitchY: 34,
            isDevSeed: true,
          },
          {
            matchId: derbyMatch.id,
            teamName: 'Galatasaray SK',
            formation: '4-2-3-1',
            playerName: 'İlkay Gündoğan',
            squadNumber: 20,
            position: 'CAM',
            isStarter: true,
            isCaptain: false,
            pitchX: 50,
            pitchY: 36,
            isDevSeed: true,
          },
          {
            matchId: derbyMatch.id,
            teamName: 'Galatasaray SK',
            formation: '4-2-3-1',
            playerName: 'Rafael Leão',
            squadNumber: 27,
            position: 'LW',
            isStarter: true,
            isCaptain: false,
            pitchX: 18,
            pitchY: 34,
            isDevSeed: true,
          },
          {
            matchId: derbyMatch.id,
            teamName: 'Galatasaray SK',
            formation: '4-2-3-1',
            playerName: 'Victor Osimhen',
            squadNumber: 45,
            position: 'ST',
            isStarter: true,
            isCaptain: false,
            pitchX: 50,
            pitchY: 16,
            isDevSeed: true,
          },
        ]);
      }
    }
  } catch (err) {
    console.error('Error seeding match centre details:', err);
  }
}

export async function getMatchCentreBundle() {
  await ensureMatchDetailsSeeded();
  const cfg = await getOrCreateFootballApiConfig();
  const [allMatches, allEvents, allLineups, allStandings] = await Promise.all([
    db.select().from(matches).orderBy(asc(matches.id)),
    db.select().from(matchEvents).orderBy(asc(matchEvents.minute)),
    db.select().from(matchLineups).orderBy(asc(matchLineups.id)),
    db.select().from(competitionStandings).orderBy(asc(competitionStandings.position)),
  ]);

  const apiKeyPresent = isFootballApiKeyPresent();

  return {
    config: {
      ...cfg,
      apiKeyConfigured: apiKeyPresent,
      providerConnectionState: apiKeyPresent
        ? cfg.lastSuccessfulSyncAt
          ? 'Operational (Verified Provider Sync)'
          : 'Configured · Ready to Sync'
        : 'Live data temporarily unavailable (FOOTBALL_API_KEY not configured in Secrets)',
    },
    matches: allMatches,
    events: allEvents,
    lineups: allLineups,
    standings: allStandings,
  };
}

export async function syncLiveFootballDataFromProvider() {
  const cfg = await getOrCreateFootballApiConfig();
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  if (!isFootballApiKeyPresent()) {
    const msg =
      'Live data temporarily unavailable: FOOTBALL_API_KEY is not configured in the AI Studio Secrets panel. Retaining last verified database records.';
    await db
      .update(footballApiConfigs)
      .set({
        lastFailedSyncAt: nowStr,
        errorCount: cfg.errorCount + 1,
        lastSafeError: msg,
        updatedAt: new Date(),
      })
      .where(eq(footballApiConfigs.id, cfg.id));

    return {
      synced: false,
      error: msg,
      bundle: await getMatchCentreBundle(),
    };
  }

  const startMs = Date.now();
  try {
    const apiKey = process.env.FOOTBALL_API_KEY!.trim();
    const baseUrl = cfg.baseUrl.replace(/\/+$/, '');
    const headers: Record<string, string> =
      cfg.provider === 'football-data'
        ? { 'X-Auth-Token': apiKey, Accept: 'application/json' }
        : { 'x-apisports-key': apiKey, Accept: 'application/json' };

    const endpoint =
      cfg.provider === 'football-data'
        ? `${baseUrl}/teams/${encodeURIComponent(cfg.teamId)}/matches?limit=5`
        : `${baseUrl}/fixtures?team=${encodeURIComponent(cfg.teamId)}&last=3&timezone=${encodeURIComponent(
            cfg.timezone
          )}`;

    const response = await fetch(endpoint, { method: 'GET', headers });
    const latency = Date.now() - startMs;

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Provider returned HTTP ${response.status}: ${text.slice(0, 120)}`);
    }

    const payload = (await response.json()) as any;
    const fixturesList = payload?.response || payload?.matches || [];

    for (const item of fixturesList.slice(0, 5)) {
      if (cfg.provider !== 'football-data' && item.fixture) {
        const fixtureDate = (item.fixture.date || '').split('T')[0] || '2026-10-09';
        const homeName = item.teams?.home?.name || 'Galatasaray SK';
        const awayName = item.teams?.away?.name || 'Opponent';
        const opponentName = homeName.toLowerCase().includes('galatasaray') ? awayName : homeName;
        const statusShort = item.fixture.status?.short || 'NS';
        const mappedStatus =
          statusShort === 'FT'
            ? 'Finished'
            : statusShort === '1H'
            ? 'First Half'
            : statusShort === 'HT'
            ? 'Half Time'
            : statusShort === '2H'
            ? 'Second Half'
            : 'Scheduled';

        await db.insert(matches).values({
          providerMatchId: String(item.fixture.id),
          competitionId: String(item.league?.id || '203'),
          competition: `${item.league?.name || 'Competition'} · ${item.league?.round || ''}`.trim(),
          season: String(item.league?.season || '2026/27'),
          homeTeam: homeName,
          awayTeam: awayName,
          opponent: opponentName,
          venue: item.fixture.venue?.name || 'RAMS Park, Istanbul',
          matchDate: fixtureDate,
          kickoffTime: (item.fixture.date || '').slice(11, 16) + ' Local',
          status: mappedStatus,
          matchMinute: Number(item.fixture.status?.elapsed || 0),
          homeScore: item.goals?.home ?? null,
          awayScore: item.goals?.away ?? null,
          referee: item.fixture.referee || 'Official Referee',
          dataSource: `Verified Provider API (${cfg.provider})`,
          lastSyncedAt: nowStr,
          isDevSeed: false,
        });
      }
    }

    await db
      .update(footballApiConfigs)
      .set({
        lastSuccessfulSyncAt: nowStr,
        lastResponseLatencyMs: latency,
        lastSafeError: `Synchronized ${fixturesList.length} fixture records from ${cfg.provider} (${latency}ms).`,
        updatedAt: new Date(),
      })
      .where(eq(footballApiConfigs.id, cfg.id));

    return {
      synced: true,
      bundle: await getMatchCentreBundle(),
    };
  } catch (err: any) {
    const latency = Date.now() - startMs;
    const safeErr = sanitizeProviderError(
      err?.message || 'Live data temporarily unavailable from football provider.'
    );

    await db
      .update(footballApiConfigs)
      .set({
        lastFailedSyncAt: nowStr,
        lastResponseLatencyMs: latency,
        errorCount: cfg.errorCount + 1,
        lastSafeError: `Live data temporarily unavailable: ${safeErr}`,
        updatedAt: new Date(),
      })
      .where(eq(footballApiConfigs.id, cfg.id));

    return {
      synced: false,
      error: `Live data temporarily unavailable: ${safeErr}`,
      bundle: await getMatchCentreBundle(),
    };
  }
}

// In-memory telemetry cache for the automated periodic squad sync engine
interface SquadSyncTelemetry {
  lastSyncAttemptAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncStatus: 'IDLE' | 'SYNCED_LIVE' | 'RETAINED_FALLBACK' | 'FAILED';
  updatedPlayerCount: number;
  totalSquadCount: number;
  syncIntervalMinutes: number;
  syncSource: string;
  nextScheduledSyncAt: string | null;
  lastMessage: string;
  autoSyncActive: boolean;
}

let squadSyncTelemetryState: SquadSyncTelemetry = {
  lastSyncAttemptAt: null,
  lastSuccessfulSyncAt: null,
  lastSyncStatus: 'IDLE',
  updatedPlayerCount: 0,
  totalSquadCount: 30,
  syncIntervalMinutes: 30, // Scheduled every 30 minutes
  syncSource: 'Official Sports Data API (API-Football / Football-Data)',
  nextScheduledSyncAt: null,
  lastMessage: 'Periodic background squad sync initialized and running.',
  autoSyncActive: true,
};

let scheduledSquadSyncTimer: NodeJS.Timeout | null = null;

export function getSquadSyncTelemetry(): SquadSyncTelemetry {
  return { ...squadSyncTelemetryState };
}

/**
 * Periodically synchronizes first-team player statistics (goals, assists, appearances, minutes, pass accuracy)
 * from the configured sports data provider (API-Football v3 /players endpoint or Football-Data).
 * If the live API key is not present or returns an error, the verified club database records remain intact
 * with safe error logging and zero data loss.
 */
export async function syncFirstTeamSquadFromProvider(): Promise<{
  success: boolean;
  updatedCount: number;
  message: string;
  telemetry: SquadSyncTelemetry;
}> {
  const cfg = await getOrCreateFootballApiConfig();
  const now = new Date();
  const nowStr = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  squadSyncTelemetryState.lastSyncAttemptAt = nowStr;

  const nextDate = new Date(now.getTime() + squadSyncTelemetryState.syncIntervalMinutes * 60 * 1000);
  squadSyncTelemetryState.nextScheduledSyncAt = nextDate.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  const existingPlayers = await db.select().from(players);
  squadSyncTelemetryState.totalSquadCount = existingPlayers.length;

  if (!isFootballApiKeyPresent()) {
    const msg =
      'FOOTBALL_API_KEY is not configured in Secrets panel. Retaining current authentic club squad statistics.';
    squadSyncTelemetryState.lastSyncStatus = 'RETAINED_FALLBACK';
    squadSyncTelemetryState.lastMessage = msg;
    squadSyncTelemetryState.updatedPlayerCount = 0;
    return {
      success: false,
      updatedCount: 0,
      message: msg,
      telemetry: { ...squadSyncTelemetryState },
    };
  }

  const apiKey = process.env.FOOTBALL_API_KEY!.trim();
  const baseUrl = cfg.baseUrl.replace(/\/+$/, '');
  const headers: Record<string, string> =
    cfg.provider === 'football-data'
      ? { 'X-Auth-Token': apiKey, Accept: 'application/json' }
      : { 'x-apisports-key': apiKey, Accept: 'application/json' };

  try {
    // API-Football endpoint for team squad player statistics for the current season
    const currentSeasonYear = '2024'; // standard season identifier for 2024-2025/2026
    const endpoint =
      cfg.provider === 'football-data'
        ? `${baseUrl}/teams/${encodeURIComponent(cfg.teamId)}`
        : `${baseUrl}/players?team=${encodeURIComponent(cfg.teamId)}&season=${currentSeasonYear}`;

    const res = await fetch(endpoint, { method: 'GET', headers });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Sports API HTTP ${res.status}: ${errText.slice(0, 100)}`);
    }

    const json = (await res.json()) as any;
    const apiPlayerList = json?.response || json?.squad || [];

    let updatedCount = 0;
    if (Array.isArray(apiPlayerList) && apiPlayerList.length > 0) {
      for (const item of apiPlayerList) {
        const pData = item.player || item;
        const pStats = item.statistics?.[0] || {};
        const pName = (pData.name || '').toLowerCase();
        const pNum = Number(pStats.games?.number || pData.shirtNumber || 0);

        // Find matching player by squad number or name match
        const matched = existingPlayers.find(
          (ep) => (pNum > 0 && ep.squadNumber === pNum) || ep.name.toLowerCase().includes(pName)
        );

        if (matched) {
          const newAppearances = Number(pStats.games?.appearences ?? pStats.games?.appearances ?? matched.appearances);
          const newGoals = Number(pStats.goals?.total ?? matched.goals);
          const newAssists = Number(pStats.goals?.assists ?? matched.assists);
          const newMinutes = Number(pStats.games?.minutes ?? matched.minutesPlayed);
          const newPassAcc = Number(pStats.passes?.accuracy ?? matched.passAccuracy);

          await db
            .update(players)
            .set({
              appearances: newAppearances,
              goals: newGoals,
              assists: newAssists,
              minutesPlayed: newMinutes,
              passAccuracy: newPassAcc,
            })
            .where(eq(players.id, matched.id));
          updatedCount++;
        }
      }
    }

    squadSyncTelemetryState.lastSuccessfulSyncAt = nowStr;
    squadSyncTelemetryState.lastSyncStatus = 'SYNCED_LIVE';
    squadSyncTelemetryState.updatedPlayerCount = updatedCount;
    const successMsg = `Successfully synchronized statistics for ${updatedCount} players from official sports API provider.`;
    squadSyncTelemetryState.lastMessage = successMsg;

    return {
      success: true,
      updatedCount,
      message: successMsg,
      telemetry: { ...squadSyncTelemetryState },
    };
  } catch (err: any) {
    const safeError = sanitizeProviderError(err?.message || 'Failed to fetch squad data from sports API.');
    squadSyncTelemetryState.lastSyncStatus = 'FAILED';
    squadSyncTelemetryState.lastMessage = `Sports data sync warning: ${safeError}`;
    return {
      success: false,
      updatedCount: 0,
      message: safeError,
      telemetry: { ...squadSyncTelemetryState },
    };
  }
}

/**
 * Initializes the backend periodic squad sync runner.
 * Runs on server boot and repeats automatically every 30 minutes without manual intervention.
 */
export function startPeriodicSquadSyncJob(intervalMinutes = 30) {
  if (scheduledSquadSyncTimer) {
    clearInterval(scheduledSquadSyncTimer);
  }

  squadSyncTelemetryState.syncIntervalMinutes = intervalMinutes;
  squadSyncTelemetryState.autoSyncActive = true;

  console.log(`[Galatasaray Engine] Scheduled squad stats sync job initialized. Interval: every ${intervalMinutes} minutes.`);

  // Execute initial sync check 10 seconds after server startup
  setTimeout(() => {
    syncFirstTeamSquadFromProvider().catch((err) => {
      console.warn('[Galatasaray Engine] Initial background squad sync run error:', err?.message);
    });
  }, 10000);

  // Set recurring periodic interval
  scheduledSquadSyncTimer = setInterval(() => {
    console.log('[Galatasaray Engine] Executing scheduled periodic squad stats synchronization...');
    syncFirstTeamSquadFromProvider().catch((err) => {
      console.warn('[Galatasaray Engine] Periodic squad sync execution warning:', err?.message);
    });
  }, intervalMinutes * 60 * 1000);
}

