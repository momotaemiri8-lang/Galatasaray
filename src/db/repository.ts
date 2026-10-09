import { db } from './index.ts';
import { sanitizeUserForClient } from '../lib/authService.ts';
import {
  users,
  membershipTiers,
  players,
  matches,
  meetSessions,
  meetBookings,
  academyApplications,
  products,
  auctions,
  auctionBids,
  orders,
  shipments,
  trackingEvents,
  cmsArticles,
  supportTickets,
  auditLogs,
  siteConfigurations,
  notifications,
  newsletterSubscriptions,
} from './schema.ts';
import { eq, desc } from 'drizzle-orm';

let seeded = false;

export async function ensureSeeded() {
  if (seeded) return;
  try {
    const existingPlayers = await db.select().from(players);
    if (existingPlayers.length > 0) {
      seeded = true;
      return;
    }

    await db.insert(membershipTiers).values([
      {
        code: 'SILVER',
        name: 'Aslan Silver Global',
        annualFee: '75.00',
        durationMonths: 12,
        benefits: [
          'Official Digital Membership Card with QR Verification',
          '48-Hour Priority Access to Home Match Tickets',
          '10% Official GSStore Global Merchandise Discount',
          'Exclusive Monthly Digital Magazine & Matchday Briefings',
        ],
        active: true,
        isDevSeed: true,
      },
      {
        code: 'GOLD',
        name: 'Cimbom Gold Lions',
        annualFee: '190.05',
        durationMonths: 12,
        benefits: [
          'All Silver Tier Benefits Included',
          'Priority Access to Meet the Stars Sessions',
          '15% Official GSStore Global Merchandise Discount',
          'Eligible to Bid on Reserve Match-Worn Auctions',
          'Annual Personalized Member Commemorative Scarf Gift',
        ],
        active: true,
        isDevSeed: true,
      },
      {
        code: 'PLATINUM',
        name: '1905 Sovereign Platinum',
        annualFee: '495.00',
        durationMonths: 12,
        benefits: [
          'All Gold Tier Benefits Included',
          'Complimentary Private Florya Metin Oktay Training Ground Tour (1/yr)',
          '20% Official GSStore Global Merchandise & Free Express Shipping',
          'Direct VIP Concierge Line & Hospitality Lounge Access',
          'Voting & Advisory Forum Participation Rights',
        ],
        active: true,
        isDevSeed: true,
      },
    ]).onConflictDoNothing();

    const insertedPlayers = await db.insert(players).values([
      {
        name: 'Mauro Icardi',
        squadNumber: 9,
        position: 'Forward',
        category: 'First Team',
        nationality: 'Argentina',
        appearances: 84,
        goals: 61,
        assists: 22,
        minutesPlayed: 6890,
        passAccuracy: 83,
        trophiesWon: 3,
        biography: 'Clinical Argentine center-forward and talismanic leader of the Istanbul attack. Renowned for elite penalty-box movement, aerial precision, and decisive derby goals at RAMS Park.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Fernando Muslera',
        squadNumber: 1,
        position: 'Goalkeeper',
        category: 'First Team',
        nationality: 'Uruguay',
        appearances: 518,
        goals: 1,
        assists: 0,
        minutesPlayed: 46520,
        passAccuracy: 81,
        trophiesWon: 17,
        biography: 'Club captain and all-time foreign appearance record holder. A cornerstone of modern Galatasaray history with seven Süper Lig titles and unmatched command of the penalty area.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Lucas Torreira',
        squadNumber: 34,
        position: 'Midfielder',
        category: 'First Team',
        nationality: 'Uruguay',
        appearances: 96,
        goals: 3,
        assists: 8,
        minutesPlayed: 8120,
        passAccuracy: 92,
        trophiesWon: 3,
        biography: 'Relentless deep-lying playmaker and ball-winning midfielder whose tactical intelligence and ball recovery anchor the midfield transition.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Baris Alper Yilmaz',
        squadNumber: 53,
        position: 'Forward',
        category: 'First Team',
        nationality: 'Turkey',
        appearances: 118,
        goals: 19,
        assists: 16,
        minutesPlayed: 7410,
        passAccuracy: 85,
        trophiesWon: 3,
        biography: 'Explosive Turkish international winger capable of operating across both flanks and full-back positions with relentless pace and physicality.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Okan Buruk',
        squadNumber: 0,
        position: 'Head Coach',
        category: 'Coaching Staff',
        nationality: 'Turkey',
        appearances: 306,
        goals: 43,
        assists: 58,
        minutesPlayed: 24500,
        passAccuracy: 89,
        trophiesWon: 16,
        biography: 'UEFA Cup 2000 winner as a player and record-breaking championship manager leading Galatasaray with high-pressing modern European tactical identity.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Gheorghe Hagi',
        squadNumber: 10,
        position: 'Legend',
        category: 'Legends',
        nationality: 'Romania',
        appearances: 192,
        goals: 72,
        assists: 63,
        minutesPlayed: 16400,
        passAccuracy: 91,
        trophiesWon: 10,
        biography: 'The Commander of the Bosphorus. Architect of the undefeated 2000 UEFA Cup and UEFA Super Cup triumphs and eternal icon of the number 10 shirt.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: false,
        isDevSeed: true,
      },
    ]).returning();

    await db.insert(matches).values([
      {
        competition: 'UEFA Champions League · League Phase',
        opponent: 'Bayern Munich',
        venue: 'RAMS Park, Istanbul',
        matchDate: '2026-10-21',
        kickoffTime: '21:00 CET',
        status: 'Upcoming',
        homeScore: null,
        awayScore: null,
        possessionPct: 56,
        shotsOnTarget: 8,
        attendance: 53798,
        isDevSeed: true,
      },
      {
        competition: 'Trendyol Süper Lig · Matchday 9',
        opponent: 'Fenerbahçe SK',
        venue: 'RAMS Park, Istanbul',
        matchDate: '2026-10-04',
        kickoffTime: '19:00 TRT',
        status: 'Completed',
        homeScore: 3,
        awayScore: 1,
        possessionPct: 61,
        shotsOnTarget: 9,
        attendance: 53950,
        isDevSeed: true,
      },
      {
        competition: 'Trendyol Süper Lig · Matchday 8',
        opponent: 'Beşiktaş JK',
        venue: 'Tüpraş Stadyumu, Istanbul',
        matchDate: '2026-09-27',
        kickoffTime: '20:00 TRT',
        status: 'Completed',
        homeScore: 2,
        awayScore: 1,
        possessionPct: 54,
        shotsOnTarget: 6,
        attendance: 42500,
        isDevSeed: true,
      },
    ]);

    const firstPlayerId = insertedPlayers[0]?.id || 1;
    await db.insert(meetSessions).values([
      {
        playerId: firstPlayerId,
        playerName: 'Mauro Icardi',
        sessionType: 'Private Video Session',
        sessionDate: '2026-10-25',
        sessionTime: '18:30 CET',
        capacity: 5,
        bookedCount: 3,
        priceEur: '250.00',
        location: 'Encrypted Live Studio Stream (Florya Hub)',
        status: 'Available',
        isDevSeed: true,
      },
      {
        playerId: insertedPlayers[1]?.id || 2,
        playerName: 'Fernando Muslera',
        sessionType: 'Training Ground Experience',
        sessionDate: '2026-11-02',
        sessionTime: '11:00 TRT',
        capacity: 12,
        bookedCount: 9,
        priceEur: '420.00',
        location: 'Florya Metin Oktay Facilities, Istanbul',
        status: 'Available',
        isDevSeed: true,
      },
      {
        playerId: insertedPlayers[4]?.id || 5,
        playerName: 'Okan Buruk & Technical Staff',
        sessionType: 'VIP Matchday Experience',
        sessionDate: '2026-10-21',
        sessionTime: '18:00 CET',
        capacity: 8,
        bookedCount: 6,
        priceEur: '680.00',
        location: 'RAMS Park Presidential Tunnel & Lounge',
        status: 'Available',
        isDevSeed: true,
      },
    ]);

    await db.insert(products).values([
      {
        sku: 'GS-2026-HOME-PRO',
        name: '2026/27 Authentic Parçalı Match Jersey',
        category: 'Official Jerseys',
        description: 'Engineered to the exact specifications worn by First Team players at RAMS Park. Features breathable laser-cut ventilation channels, heat-applied metallic gold four-star crest, and official holographic authenticity security seal.',
        priceEur: '139.00',
        stockQuantity: 48,
        sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        condition: 'New Official',
        authenticityCode: 'GS-AUTH-994021-TR',
        imageUrl: '/src/assets/images/product_official_home_kit_1791538209587.jpg',
        featured: true,
        isDevSeed: true,
      },
      {
        sku: 'GS-2026-SIGNED-ICARDI',
        name: 'Mauro Icardi Hand-Signed Framed Home Shirt',
        category: 'Signed Jerseys',
        description: 'Official 2026/27 Parçalı jersey hand-signed in metallic gold ink by Mauro Icardi during the official Florya signing session. Supplied with tamper-proof hologram and numbered club Certificate of Authenticity.',
        priceEur: '490.00',
        stockQuantity: 7,
        sizes: ['L (Framed Display)'],
        condition: 'Authenticated Signed Collector Piece',
        authenticityCode: 'GS-COA-IC9-2026',
        imageUrl: '/src/assets/images/auction_match_worn_shirt_1791538221590.jpg',
        featured: true,
        isDevSeed: true,
      },
      {
        sku: 'GS-2026-TRAIN-ELITE',
        name: 'Florya Pro Technical Quarter-Zip Training Top',
        category: 'Training Wear',
        description: 'High-stretch thermal training layer worn by the first team squad during European night preparations. Deep obsidian black with crimson and gold crest detailing.',
        priceEur: '89.00',
        stockQuantity: 64,
        sizes: ['S', 'M', 'L', 'XL'],
        condition: 'New Official',
        authenticityCode: 'GS-AUTH-440182-TR',
        imageUrl: '/src/assets/images/product_official_home_kit_1791538209587.jpg',
        featured: true,
        isDevSeed: true,
      },
      {
        sku: 'GS-1905-HERITAGE-SCARF',
        name: '1905 Sovereign Jacquard Silk-Wool Scarf',
        category: 'Scarves',
        description: 'Heavyweight virgin wool and silk blend supporter scarf woven in Istanbul with metallic gold fringe and historic 1905 founding insignia.',
        priceEur: '45.00',
        stockQuantity: 120,
        sizes: ['One Size (145cm x 22cm)'],
        condition: 'New Official',
        authenticityCode: 'GS-AUTH-190501-TR',
        imageUrl: '/src/assets/images/product_official_home_kit_1791538209587.jpg',
        featured: false,
        isDevSeed: true,
      },
    ]);

    const futureDate1 = new Date(Date.now() + 1000 * 60 * 60 * 38);
    const futureDate2 = new Date(Date.now() + 1000 * 60 * 60 * 72);

    await db.insert(auctions).values([
      {
        itemTitle: 'Mauro Icardi Match-Worn & Signed Derby Jersey (Unwashed)',
        playerName: 'Mauro Icardi #9',
        matchFixture: 'Galatasaray 3 - 1 Fenerbahçe',
        competition: 'Trendyol Süper Lig',
        season: '2026/27',
        matchDate: '2026-10-04',
        itemCondition: 'Match-Worn, Unwashed with Pitch Marks & Gold Signature',
        certificateNumber: 'GS-MW-2026-DERBY-09',
        startingPriceEur: '850.00',
        reservePriceEur: '1500.00',
        bidIncrementEur: '100.00',
        currentHighestBidEur: '2450.00',
        highestBidderUid: 'seed-collector',
        highestBidderName: 'K. Özdemir (Zurich)',
        bidCount: 14,
        endsAt: futureDate1,
        status: 'Open',
        imageUrl: '/src/assets/images/auction_match_worn_shirt_1791538221590.jpg',
        isDevSeed: true,
      },
      {
        itemTitle: 'Fernando Muslera Match-Worn Captain Jersey & Gloves Set',
        playerName: 'Fernando Muslera #1',
        matchFixture: 'Galatasaray 2 - 1 Beşiktaş',
        competition: 'Trendyol Süper Lig',
        season: '2026/27',
        matchDate: '2026-09-27',
        itemCondition: 'Match-Worn Captain Issue with Dual Signatures',
        certificateNumber: 'GS-MW-2026-CAP-01',
        startingPriceEur: '700.00',
        reservePriceEur: '1200.00',
        bidIncrementEur: '50.00',
        currentHighestBidEur: '1650.00',
        highestBidderUid: 'seed-collector-2',
        highestBidderName: 'E. Kaya (London)',
        bidCount: 9,
        endsAt: futureDate2,
        status: 'Open',
        imageUrl: '/src/assets/images/auction_match_worn_shirt_1791538221590.jpg',
        isDevSeed: true,
      },
    ]);

    await db.insert(shipments).values([
      {
        trackingNumber: 'GS-INTL-19058824TR',
        orderNumber: 'GS-ORD-90411',
        userUid: 'public-demo',
        recipientName: 'Emre Yildirim',
        originFacility: 'Istanbul Airport Global Logistics Hub (IST), Turkey',
        currentLocation: 'Frankfurt Air Cargo Terminal (FRA), Germany',
        destinationCity: 'London',
        destinationCountry: 'United Kingdom',
        courierProvider: 'Galatasaray Global Express (DHL Air Bridge)',
        serviceLevel: 'Express Priority Air',
        weightKg: '1.15',
        dimensionsCm: '40x30x10 cm',
        estimatedDelivery: '2026-10-12 by 18:00 Local',
        status: 'International Transit',
        originLat: '41.2753',
        originLng: '28.7519',
        currentLat: '50.0379',
        currentLng: '8.5622',
        destLat: '51.5074',
        destLng: '-0.1278',
        dataSourceMode: 'Admin Controlled Milestone',
        isDevSeed: true,
      },
    ]).onConflictDoNothing();

    await db.insert(trackingEvents).values([
      {
        trackingNumber: 'GS-INTL-19058824TR',
        stage: 'Order Received',
        facility: 'RAMS Park GSStore Fulfillment Center, Istanbul',
        description: 'Official order verified with holographic authenticity seal #GS-AUTH-994021-TR.',
        eventTimestamp: '2026-10-07 14:20 TRT',
      },
      {
        trackingNumber: 'GS-INTL-19058824TR',
        stage: 'Origin Facility',
        facility: 'Istanbul Airport Global Logistics Hub (IST), Turkey',
        description: 'Export customs clearance completed and loaded onto European cargo flight.',
        eventTimestamp: '2026-10-08 06:45 TRT',
      },
      {
        trackingNumber: 'GS-INTL-19058824TR',
        stage: 'International Transit',
        facility: 'Frankfurt Air Cargo Terminal (FRA), Germany',
        description: 'Arrived at European sorting hub; scheduled for onward connection to London Heathrow.',
        eventTimestamp: '2026-10-09 01:15 CET',
      },
    ]);

    await db.insert(academyApplications).values([
      {
        applicationCode: 'GS-ACAD-2026-819',
        userUid: 'seed-applicant',
        applicantName: 'Arda Demirci',
        dateOfBirth: '2009-04-14',
        nationality: 'Turkish',
        country: 'Germany',
        currentClub: 'U17 Regional Youth Academy Berlin',
        position: 'Attacking Midfielder (10 / 8)',
        preferredFoot: 'Left',
        heightCm: 178,
        weightKg: 68,
        playingLevel: 'U17 Bundesliga Regional',
        experienceSummary: '4 seasons at youth academy level; 14 goals and 19 assists in 28 matches last season.',
        guardianName: 'Hakan Demirci',
        phone: '+49 172 555 0192',
        email: 'arda.demirci.scout@example.com',
        highlightVideoUrl: 'https://video.galatasaray.org/scouting/arda-2026',
        documentCvName: 'Arda_Demirci_Player_CV_2026.pdf',
        medicalDeclaration: true,
        personalStatement: 'My ambition is to represent Galatasaray at RAMS Park and develop through the Florya tactical curriculum.',
        status: 'Shortlisted',
        scoutScore: 89,
        assignedScout: 'Emre Çolak (European Youth Directorate)',
        internalNotes: 'Exceptional close control under pressure and progressive passing vision. Recommended for November Florya trial.',
        isDevSeed: true,
      },
    ]);

    await db.insert(cmsArticles).values([
      {
        slug: 'champions-league-preparations-florya',
        title: 'Tactical Focus at Florya Ahead of European Night at RAMS Park',
        category: 'News',
        summary: 'Head Coach Okan Buruk oversaw an intensive high-pressing session at the Florya Metin Oktay Facilities ahead of our upcoming European fixture.',
        body: 'The First Team squad completed a two-hour tactical session focusing on rapid vertical transitions, set-piece organization, and high recovery press. Over 53,000 supporters are expected at RAMS Park with full stadium choreography prepared by the ultras.',
        status: 'Published',
        metaTitle: 'Tactical Focus at Florya | Galatasaray Official Digital Platform',
        metaDescription: 'Read the full training report from Florya Metin Oktay Facilities ahead of our European clash at RAMS Park.',
        publishedAt: '2026-10-08',
        isDevSeed: true,
      },
      {
        slug: 'florya-international-academy-trials-2026',
        title: '2026/27 Global Youth Scouting & Florya Academy Intake Open',
        category: 'Academy Announcement',
        summary: 'Applications are now open for U14–U19 international talents seeking assessment by the Galatasaray Youth Development Directorate.',
        body: 'Our academy pathway combines UEFA Pro-licensed coaching, sports science telemetry, and academic education in Istanbul. Shortlisted applicants receive official trial invitations to Florya.',
        status: 'Published',
        metaTitle: 'Global Youth Academy Intake | Galatasaray SK',
        metaDescription: 'Apply online for the 2026/27 Galatasaray Football Academy international scouting evaluation.',
        publishedAt: '2026-10-05',
        isDevSeed: true,
      },
    ]);

    await db.insert(siteConfigurations).values([
      { configKey: 'club_headline', configValue: 'Sovereign Passion of Istanbul · Since 1905', category: 'Brand' },
      { configKey: 'primary_currency', configValue: 'EUR (€)', category: 'Payment' },
    ]).onConflictDoNothing();

    seeded = true;
  } catch (error) {
    console.error('Error seeding initial data:', error);
  }
}

export async function getOrCreateUser(uid: string, email: string, fullName?: string) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const initialRole = cleanEmail === 'luxmartsupport@gmail.com' ? 'ADMIN' : 'USER';
    const existingByUid = await db.select().from(users).where(eq(users.uid, uid));
    if (existingByUid.length > 0) {
      const current = existingByUid[0];
      const normalizedRole =
        cleanEmail === 'luxmartsupport@gmail.com'
          ? 'ADMIN'
          : current.role === 'ADMIN' || current.role === 'Super Administrator'
          ? 'ADMIN'
          : 'USER';
      if (current.role !== normalizedRole) {
        const updated = await db
          .update(users)
          .set({ role: normalizedRole })
          .where(eq(users.uid, uid))
          .returning();
        return updated[0];
      }
      return current;
    }

    const result = await db
      .insert(users)
      .values({
        uid,
        email: cleanEmail,
        fullName: fullName || email.split('@')[0] || 'Supporter',
        role: initialRole,
        emailVerified: true,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: cleanEmail,
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function logAdminAction(
  adminEmail: string,
  action: string,
  affectedEntity: string,
  previousValue = '',
  newValue = ''
) {
  try {
    await db.insert(auditLogs).values({
      adminEmail,
      action,
      affectedEntity,
      previousValue,
      newValue,
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

export async function getPublicBootstrapData() {
  try {
    await ensureSeeded();
    const [
      allPlayers,
      allMatches,
      allTiers,
      allSessions,
      allProducts,
      allAuctions,
      allArticles,
      allConfigs,
      allBids,
    ] = await Promise.all([
      db.select().from(players).orderBy(players.squadNumber),
      db.select().from(matches).orderBy(desc(matches.matchDate)),
      db.select().from(membershipTiers).orderBy(membershipTiers.id),
      db.select().from(meetSessions).orderBy(meetSessions.sessionDate),
      db.select().from(products).orderBy(products.id),
      db.select().from(auctions).orderBy(auctions.id),
      db.select().from(cmsArticles).orderBy(desc(cmsArticles.id)),
      db.select().from(siteConfigurations),
      db.select().from(auctionBids).orderBy(desc(auctionBids.createdAt)),
    ]);

    return {
      players: allPlayers,
      matches: allMatches,
      membershipTiers: allTiers,
      meetSessions: allSessions,
      products: allProducts,
      auctions: allAuctions,
      articles: allArticles,
      configurations: allConfigs,
      recentBids: allBids.slice(0, 20),
    };
  } catch (error) {
    console.error('Database query failed in getPublicBootstrapData:', error);
    throw new Error('Unable to load club platform data.', { cause: error });
  }
}

export async function getShipmentWithEvents(trackingNumber: string) {
  try {
    await ensureSeeded();
    const cleanNum = trackingNumber.trim().toUpperCase();
    const found = await db.select().from(shipments).where(eq(shipments.trackingNumber, cleanNum));
    if (!found.length) return null;
    const events = await db
      .select()
      .from(trackingEvents)
      .where(eq(trackingEvents.trackingNumber, cleanNum))
      .orderBy(trackingEvents.id);
    return {
      shipment: found[0],
      events,
    };
  } catch (error) {
    console.error('Database query failed in getShipmentWithEvents:', error);
    throw new Error('Unable to query shipment tracking information.', { cause: error });
  }
}

export async function getUserDashboardBundle(uid: string, email: string, name?: string) {
  try {
    const rawProfile = await getOrCreateUser(uid, email, name);
    const profile = sanitizeUserForClient(rawProfile);
    const [userOrders, userBookings, userApps, userBids, userTickets, userNotifs, userShipments] =
      await Promise.all([
        db.select().from(orders).where(eq(orders.userUid, uid)).orderBy(desc(orders.createdAt)),
        db.select().from(meetBookings).where(eq(meetBookings.userUid, uid)).orderBy(desc(meetBookings.createdAt)),
        db.select().from(academyApplications).where(eq(academyApplications.userUid, uid)).orderBy(desc(academyApplications.createdAt)),
        db.select().from(auctionBids).where(eq(auctionBids.userUid, uid)).orderBy(desc(auctionBids.createdAt)),
        db.select().from(supportTickets).where(eq(supportTickets.userUid, uid)).orderBy(desc(supportTickets.createdAt)),
        db.select().from(notifications).where(eq(notifications.userUid, uid)).orderBy(desc(notifications.createdAt)),
        db.select().from(shipments).where(eq(shipments.userUid, uid)).orderBy(desc(shipments.updatedAt)),
      ]);

    return {
      profile,
      orders: userOrders,
      bookings: userBookings,
      academyApplications: userApps,
      bids: userBids,
      tickets: userTickets,
      notifications: userNotifs,
      shipments: userShipments,
    };
  } catch (error) {
    console.error('Database query failed in getUserDashboardBundle:', error);
    throw new Error('Unable to load personal supporter dashboard.', { cause: error });
  }
}

export async function getAdminOverviewBundle() {
  try {
    const [
      allUsers,
      allOrders,
      allBookings,
      allApps,
      allShipments,
      allTickets,
      allLogs,
      allSubscribers,
    ] = await Promise.all([
      db.select().from(users).orderBy(desc(users.createdAt)),
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(meetBookings).orderBy(desc(meetBookings.createdAt)),
      db.select().from(academyApplications).orderBy(desc(academyApplications.createdAt)),
      db.select().from(shipments).orderBy(desc(shipments.updatedAt)),
      db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)),
      db.select().from(newsletterSubscriptions).orderBy(desc(newsletterSubscriptions.createdAt)),
    ]);

    return {
      users: allUsers.map(sanitizeUserForClient),
      orders: allOrders,
      bookings: allBookings,
      academyApplications: allApps,
      shipments: allShipments,
      tickets: allTickets,
      auditLogs: allLogs.slice(0, 50),
      newsletterSubscribers: allSubscribers,
    };
  } catch (error) {
    console.error('Database query failed in getAdminOverviewBundle:', error);
    throw new Error('Unable to load administrative control center data.', { cause: error });
  }
}
