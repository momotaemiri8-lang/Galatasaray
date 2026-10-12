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
      // Goalkeepers
      {
        name: 'Uğurcan Çakır',
        squadNumber: 1,
        position: 'Goalkeeper',
        category: 'First Team',
        nationality: 'Turkey',
        appearances: 38,
        goals: 0,
        assists: 1,
        minutesPlayed: 3420,
        passAccuracy: 84,
        trophiesWon: 4,
        biography: 'Turkish international number one goalkeeper with commanding aerial authority, elite shot-stopping reflexes, and sweeping distribution from the back.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Günay Güvenç',
        squadNumber: 19,
        position: 'Goalkeeper',
        category: 'First Team',
        nationality: 'Turkey',
        appearances: 22,
        goals: 0,
        assists: 0,
        minutesPlayed: 1980,
        passAccuracy: 82,
        trophiesWon: 3,
        biography: 'Experienced veteran shot-stopper providing dependable penalty-box leadership and composure in domestic and European fixtures.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Jankat Yılmaz',
        squadNumber: 24,
        position: 'Goalkeeper',
        category: 'First Team',
        nationality: 'Turkey',
        appearances: 6,
        goals: 0,
        assists: 0,
        minutesPlayed: 540,
        passAccuracy: 80,
        trophiesWon: 2,
        biography: 'Florya Academy graduate goalkeeper recognized for rapid reaction saves and strong one-on-one positioning.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: false,
        isDevSeed: true,
      },
      {
        name: 'Arda Yılmaz',
        squadNumber: 60,
        position: 'Goalkeeper',
        category: 'First Team',
        nationality: 'Turkey',
        appearances: 3,
        goals: 0,
        assists: 0,
        minutesPlayed: 270,
        passAccuracy: 79,
        trophiesWon: 1,
        biography: 'Promising young goalkeeper developed through the Galatasaray youth system with modern ball-playing fundamentals.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: false,
        isDevSeed: true,
      },
      {
        name: 'Enes Emre Büyük',
        squadNumber: 70,
        position: 'Goalkeeper',
        category: 'First Team',
        nationality: 'Turkey',
        appearances: 2,
        goals: 0,
        assists: 0,
        minutesPlayed: 180,
        passAccuracy: 81,
        trophiesWon: 1,
        biography: 'Athletic young goalkeeper training with the First Team keeper union at Florya Metin Oktay Facilities.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: false,
        isDevSeed: true,
      },

      // Defenders
      {
        name: 'El Chadaille Bitshiabu',
        squadNumber: 3,
        position: 'Centre-Back',
        category: 'First Team',
        nationality: 'France',
        appearances: 27,
        goals: 2,
        assists: 1,
        minutesPlayed: 2290,
        passAccuracy: 91,
        trophiesWon: 3,
        biography: 'Towering left-footed French centre-back combining physical dominance in duels with progressive line-breaking left-foot distribution.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Ismail Jakobs',
        squadNumber: 4,
        position: 'Left-Back',
        category: 'First Team',
        nationality: 'Senegal',
        appearances: 34,
        goals: 1,
        assists: 6,
        minutesPlayed: 2890,
        passAccuracy: 86,
        trophiesWon: 2,
        biography: 'Dynamic Senegalese international left-back offering relentless overlapping recovery pace and defensive tenacity along the touchline.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Davinson Sánchez',
        squadNumber: 6,
        position: 'Centre-Back',
        category: 'First Team',
        nationality: 'Colombia',
        appearances: 68,
        goals: 7,
        assists: 4,
        minutesPlayed: 5940,
        passAccuracy: 90,
        trophiesWon: 3,
        biography: 'Colombian international defensive pillar renowned for high-line recovery speed, aggressive front-foot interceptions, and aerial dominance at RAMS Park.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Eren Elmalı',
        squadNumber: 17,
        position: 'Left-Back',
        category: 'First Team',
        nationality: 'Turkey',
        appearances: 31,
        goals: 1,
        assists: 5,
        minutesPlayed: 2510,
        passAccuracy: 85,
        trophiesWon: 2,
        biography: 'Turkish national team full-back bringing high-work-rate wing play, accurate early crosses, and disciplined defensive transitions.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Kaan Ayhan',
        squadNumber: 23,
        position: 'Centre-Back / Defender',
        category: 'First Team',
        nationality: 'Turkey',
        appearances: 89,
        goals: 4,
        assists: 7,
        minutesPlayed: 6950,
        passAccuracy: 89,
        trophiesWon: 3,
        biography: 'Tactically versatile Turkish international defender capable of operating at centre-back, right-back, and defensive midfield with elite composure.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Abdülkerim Bardakcı',
        squadNumber: 42,
        position: 'Centre-Back',
        category: 'First Team',
        nationality: 'Turkey',
        appearances: 112,
        goals: 14,
        assists: 5,
        minutesPlayed: 9840,
        passAccuracy: 89,
        trophiesWon: 4,
        biography: 'Commanding ball-playing Turkish international centre-back known for his diagonal switches of play and decisive set-piece headers.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Kazımcan Karataş',
        squadNumber: 88,
        position: 'Left-Back',
        category: 'First Team',
        nationality: 'Turkey',
        appearances: 24,
        goals: 0,
        assists: 2,
        minutesPlayed: 1620,
        passAccuracy: 83,
        trophiesWon: 2,
        biography: 'Energetic Turkish left-back providing athletic width and committed defensive pressing along the left flank.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: false,
        isDevSeed: true,
      },
      {
        name: 'Wilfried Singo',
        squadNumber: 90,
        position: 'Right-Back',
        category: 'First Team',
        nationality: 'Ivory Coast',
        appearances: 33,
        goals: 3,
        assists: 6,
        minutesPlayed: 2880,
        passAccuracy: 87,
        trophiesWon: 2,
        biography: 'Explosive Ivorian international right-back and central defender blending powerhouse athleticism with surging ball carries down the right channel.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Arda Ünyay',
        squadNumber: 91,
        position: 'Centre-Back',
        category: 'First Team',
        nationality: 'Turkey',
        appearances: 8,
        goals: 0,
        assists: 0,
        minutesPlayed: 560,
        passAccuracy: 88,
        trophiesWon: 1,
        biography: 'Highly rated young Turkish central defender with calm build-up distribution and strong positional reading of the game.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: false,
        isDevSeed: true,
      },

      // Midfielders
      {
        name: 'Eyüp Aydın',
        squadNumber: 5,
        position: 'Defensive Midfield',
        category: 'First Team',
        nationality: 'Turkey',
        appearances: 19,
        goals: 1,
        assists: 2,
        minutesPlayed: 980,
        passAccuracy: 89,
        trophiesWon: 2,
        biography: 'Technically gifted deep-lying midfielder trained in elite European youth football, offering crisp passing angles and set-piece delivery.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: false,
        isDevSeed: true,
      },
      {
        name: 'Gabriel Sara',
        squadNumber: 8,
        position: 'Central Midfield',
        category: 'First Team',
        nationality: 'Brazil',
        appearances: 44,
        goals: 8,
        assists: 14,
        minutesPlayed: 3780,
        passAccuracy: 90,
        trophiesWon: 2,
        biography: 'Brazilian box-to-box playmaker and set-piece specialist orchestrating Galatasaray’s midfield tempo with left-footed vision and long-range strikes.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Lesley Ugochukwu',
        squadNumber: 18,
        position: 'Defensive Midfield',
        category: 'First Team',
        nationality: 'France',
        appearances: 29,
        goals: 2,
        assists: 3,
        minutesPlayed: 2340,
        passAccuracy: 91,
        trophiesWon: 1,
        biography: 'Commanding French holding midfielder who anchors the central zone with long-stride ball recoveries and press-resistant distribution.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'İlkay Gündoğan',
        squadNumber: 20,
        position: 'Central Midfield',
        category: 'First Team',
        nationality: 'Germany',
        appearances: 39,
        goals: 9,
        assists: 12,
        minutesPlayed: 3310,
        passAccuracy: 93,
        trophiesWon: 14,
        biography: 'UEFA Champions League-winning midfield maestro bringing world-class tempo control, late penalty-box arrivals, and championship leadership to RAMS Park.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Lucas Torreira',
        squadNumber: 34,
        position: 'Defensive Midfield',
        category: 'First Team',
        nationality: 'Uruguay',
        appearances: 114,
        goals: 5,
        assists: 10,
        minutesPlayed: 9640,
        passAccuracy: 92,
        trophiesWon: 4,
        biography: 'Relentless Uruguayan deep-lying playmaker and ball-winning midfielder whose tactical intelligence and ball recovery anchor the midfield transition.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Renato Nhaga',
        squadNumber: 74,
        position: 'Central Midfield',
        category: 'First Team',
        nationality: 'Guinea-Bissau',
        appearances: 14,
        goals: 1,
        assists: 2,
        minutesPlayed: 890,
        passAccuracy: 87,
        trophiesWon: 1,
        biography: 'Dynamic young central midfielder providing energetic ball progression and high-intensity pressing in the middle third.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: false,
        isDevSeed: true,
      },
      {
        name: 'Aleksey Batrakov',
        squadNumber: 83,
        position: 'Attacking Midfield',
        category: 'First Team',
        nationality: 'Russia',
        appearances: 26,
        goals: 7,
        assists: 9,
        minutesPlayed: 2040,
        passAccuracy: 88,
        trophiesWon: 1,
        biography: 'Creative attacking midfielder operating between the lines with incisive through-balls, close control in tight pockets, and clinical finishing.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Mario Lemina',
        squadNumber: 99,
        position: 'Defensive Midfield',
        category: 'First Team',
        nationality: 'Gabon',
        appearances: 62,
        goals: 4,
        assists: 5,
        minutesPlayed: 4890,
        passAccuracy: 89,
        trophiesWon: 2,
        biography: 'Powerful Gabonese international midfielder celebrated by the RAMS Park faithful for his press resistance, ball-carrying drives, and defensive grit.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },

      // Forwards & Wingers
      {
        name: 'Roland Sallai',
        squadNumber: 7,
        position: 'Right-Winger / Forward',
        category: 'First Team',
        nationality: 'Hungary',
        appearances: 36,
        goals: 8,
        assists: 7,
        minutesPlayed: 2760,
        passAccuracy: 84,
        trophiesWon: 2,
        biography: 'Hungarian international attacker known for relentless pressing, direct dribbling across the frontline, and clinical two-footed strikes.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Leroy Sané',
        squadNumber: 10,
        position: 'Right-Winger',
        category: 'First Team',
        nationality: 'Germany',
        appearances: 35,
        goals: 14,
        assists: 13,
        minutesPlayed: 2980,
        passAccuracy: 86,
        trophiesWon: 15,
        biography: 'Electrifying German international number 10 whose blistering acceleration, inverted left-footed curlers, and Champions League pedigree light up RAMS Park.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Yunus Akgün',
        squadNumber: 11,
        position: 'Right-Winger',
        category: 'First Team',
        nationality: 'Turkey',
        appearances: 94,
        goals: 18,
        assists: 21,
        minutesPlayed: 6420,
        passAccuracy: 87,
        trophiesWon: 4,
        biography: 'Florya Academy jewel and Turkish international winger dazzling supporters with low-center-of-gravity dribbling and creative final-third combinations.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Deniz Gül',
        squadNumber: 21,
        position: 'Centre-Forward',
        category: 'First Team',
        nationality: 'Turkey',
        appearances: 20,
        goals: 6,
        assists: 2,
        minutesPlayed: 1180,
        passAccuracy: 81,
        trophiesWon: 1,
        biography: 'Physical modern Turkish centre-forward combining intelligent hold-up play with sharp movement inside the penalty box.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: false,
        isDevSeed: true,
      },
      {
        name: 'Rafael Leão',
        squadNumber: 27,
        position: 'Left-Winger',
        category: 'First Team',
        nationality: 'Portugal',
        appearances: 37,
        goals: 16,
        assists: 14,
        minutesPlayed: 3190,
        passAccuracy: 85,
        trophiesWon: 4,
        biography: 'Superstar Portuguese international left-winger with unstoppable one-on-one flair, effortless stride power, and match-winning artistry.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Armando Güner',
        squadNumber: 29,
        position: 'Right-Winger',
        category: 'First Team',
        nationality: 'Turkey',
        appearances: 11,
        goals: 2,
        assists: 2,
        minutesPlayed: 640,
        passAccuracy: 83,
        trophiesWon: 1,
        biography: 'Exciting young wide forward bringing fearless one-v-one isolation skills and pace off the flanks.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: false,
        isDevSeed: true,
      },
      {
        name: 'Victor Osimhen',
        squadNumber: 45,
        position: 'Centre-Forward',
        category: 'First Team',
        nationality: 'Nigeria',
        appearances: 42,
        goals: 34,
        assists: 8,
        minutesPlayed: 3650,
        passAccuracy: 82,
        trophiesWon: 3,
        biography: 'World-class Nigerian striker and masked talisman of Istanbul. Unmatched aerial leap, explosive channel runs, and lethal penalty-box finishing.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
        isDevSeed: true,
      },
      {
        name: 'Barış Alper Yılmaz',
        squadNumber: 53,
        position: 'Left-Winger / Forward',
        category: 'First Team',
        nationality: 'Turkey',
        appearances: 126,
        goals: 22,
        assists: 19,
        minutesPlayed: 8140,
        passAccuracy: 85,
        trophiesWon: 4,
        biography: 'Explosive Turkish international winger and forward operating across the frontline with relentless power, pressing intensity, and big-match goals.',
        imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
        meetAndGreetAvailable: true,
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

    const osimhenPlayer = insertedPlayers.find((p) => p.squadNumber === 45) || insertedPlayers[0];
    const cakirPlayer = insertedPlayers.find((p) => p.squadNumber === 1) || insertedPlayers[0];
    const sanePlayer = insertedPlayers.find((p) => p.squadNumber === 10) || insertedPlayers[0];

    await db.insert(meetSessions).values([
      {
        playerId: osimhenPlayer?.id || 1,
        playerName: 'Victor Osimhen #45',
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
        playerId: cakirPlayer?.id || 2,
        playerName: 'Uğurcan Çakır #1',
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
        playerId: sanePlayer?.id || 3,
        playerName: 'Leroy Sané #10 & İlkay Gündoğan #20',
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
        sku: 'GS-2026-SIGNED-OSIMHEN',
        name: 'Victor Osimhen #45 Hand-Signed Framed Home Shirt',
        category: 'Signed Jerseys',
        description: 'Official 2026/27 Parçalı jersey hand-signed in metallic gold ink by Victor Osimhen during the official Florya signing session. Supplied with tamper-proof hologram and numbered club Certificate of Authenticity.',
        priceEur: '490.00',
        stockQuantity: 7,
        sizes: ['L (Framed Display)'],
        condition: 'Authenticated Signed Collector Piece',
        authenticityCode: 'GS-COA-VO45-2026',
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
        itemTitle: 'Victor Osimhen #45 Match-Worn & Signed Derby Jersey (Unwashed)',
        playerName: 'Victor Osimhen #45',
        matchFixture: 'Galatasaray 3 - 1 Fenerbahçe',
        competition: 'Trendyol Süper Lig',
        season: '2026/27',
        matchDate: '2026-10-04',
        itemCondition: 'Match-Worn, Unwashed with Pitch Marks & Gold Signature',
        certificateNumber: 'GS-MW-2026-DERBY-45',
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
        itemTitle: 'Uğurcan Çakır #1 Match-Worn Goalkeeper Jersey & Gloves Set',
        playerName: 'Uğurcan Çakır #1',
        matchFixture: 'Galatasaray 2 - 1 Beşiktaş',
        competition: 'Trendyol Süper Lig',
        season: '2026/27',
        matchDate: '2026-09-27',
        itemCondition: 'Match-Worn Goalkeeper Issue with Dual Signatures',
        certificateNumber: 'GS-MW-2026-GK-01',
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
