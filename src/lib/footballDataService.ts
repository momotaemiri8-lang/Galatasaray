import { db } from '../db/index.ts';
import {
  matches,
  matchEvents,
  matchLineups,
  competitionStandings,
  footballApiConfigs,
} from '../db/schema.ts';
import { eq, asc } from 'drizzle-orm';
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
            playerName: 'Mauro Icardi',
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
            playerName: 'Fernando Muslera',
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
            playerName: 'Kaan Ayhan',
            squadNumber: 23,
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
            squadNumber: 20,
            position: 'CDM',
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
            playerName: 'Barış Alper Yılmaz',
            squadNumber: 53,
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
            playerName: 'Dries Mertens',
            squadNumber: 10,
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
            playerName: 'Yunus Akgün',
            squadNumber: 11,
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
            playerName: 'Mauro Icardi',
            squadNumber: 9,
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
