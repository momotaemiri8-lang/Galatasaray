import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull().default("Supporter"),
  phone: text("phone").default(""),
  country: text("country").default("Turkey"),
  dateOfBirth: text("date_of_birth").default(""),
  role: text("role").notNull().default("USER"), // USER or ADMIN
  passwordHash: text("password_hash").default(""),
  passwordSalt: text("password_salt").default(""),
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationTokenHash: text("verification_token_hash").default(""),
  verificationTokenExpiresAt: timestamp("verification_token_expires_at"),
  resetTokenHash: text("reset_token_hash").default(""),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  accountDisabled: boolean("account_disabled").notNull().default(false),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  lastLoginAt: timestamp("last_login_at"),
  membershipTier: text("membership_tier").notNull().default("NONE"), // NONE, SILVER, GOLD, PLATINUM
  membershipNumber: text("membership_number").default(""),
  membershipStatus: text("membership_status").default("Inactive"), // Active, Suspended, Expired, Inactive
  membershipExpiry: text("membership_expiry").default(""),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const authSessions = pgTable("auth_sessions", {
  id: serial("id").primaryKey(),
  sessionTokenHash: text("session_token_hash").notNull().unique(),
  userUid: text("user_uid").notNull(),
  userEmail: text("user_email").notNull(),
  userRole: text("user_role").notNull().default("USER"),
  csrfToken: text("csrf_token").notNull(),
  rememberMe: boolean("remember_me").notNull().default(false),
  ipAddress: text("ip_address").default(""),
  userAgent: text("user_agent").default(""),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const membershipTiers = pgTable("membership_tiers", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // SILVER, GOLD, PLATINUM
  name: text("name").notNull(),
  annualFee: numeric("annual_fee", { precision: 10, scale: 2 }).notNull(),
  durationMonths: integer("duration_months").notNull().default(12),
  benefits: jsonb("benefits").$type<string[]>().notNull(),
  active: boolean("active").notNull().default(true),
  isDevSeed: boolean("is_dev_seed").notNull().default(false),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  squadNumber: integer("squad_number").notNull(),
  position: text("position").notNull(), // Goalkeeper, Defender, Midfielder, Forward, Head Coach, Technical Staff, Legend
  category: text("category").notNull().default("First Team"), // First Team, Coaching Staff, Technical Staff, Club Officials, Academy, Legends
  nationality: text("nationality").notNull(),
  appearances: integer("appearances").notNull().default(0),
  goals: integer("goals").notNull().default(0),
  assists: integer("assists").notNull().default(0),
  minutesPlayed: integer("minutes_played").notNull().default(0),
  passAccuracy: integer("pass_accuracy").notNull().default(88),
  trophiesWon: integer("trophies_won").notNull().default(0),
  biography: text("biography").notNull(),
  imageUrl: text("image_url").notNull(),
  meetAndGreetAvailable: boolean("meet_and_greet_available").notNull().default(true),
  isDevSeed: boolean("is_dev_seed").notNull().default(false),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  providerMatchId: text("provider_match_id").default(""),
  competitionId: text("competition_id").default("203"),
  competition: text("competition").notNull(),
  season: text("season").notNull().default("2026/27"),
  homeTeam: text("home_team").notNull().default("Galatasaray SK"),
  awayTeam: text("away_team").notNull().default("Opponent"),
  opponent: text("opponent").notNull(),
  venue: text("venue").notNull(), // RAMS Park, Away
  matchDate: text("match_date").notNull(),
  kickoffTime: text("kickoff_time").notNull(),
  status: text("status").notNull().default("Upcoming"), // Scheduled, Not Started, First Half, Half Time, Second Half, Extra Time, Penalty Shootout, Finished, Postponed, Cancelled, Suspended, Upcoming, Completed
  matchMinute: integer("match_minute").default(0),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  referee: text("referee").default("UEFA / TFF Appointed Official"),
  possessionPct: integer("possession_pct").default(58),
  shotsTotal: integer("shots_total").default(15),
  shotsOnTarget: integer("shots_on_target").default(7),
  corners: integer("corners").default(6),
  fouls: integer("fouls").default(11),
  offsides: integer("offsides").default(2),
  yellowCards: integer("yellow_cards").default(2),
  redCards: integer("red_cards").default(0),
  attendance: integer("attendance").default(52480),
  dataSource: text("data_source").notNull().default("Authorized Club Database"), // Verified Provider API, Authorized Club Database
  lastSyncedAt: text("last_synced_at").default(""),
  isDevSeed: boolean("is_dev_seed").notNull().default(false),
});

export const matchEvents = pgTable("match_events", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  minute: integer("minute").notNull(),
  addedTime: integer("added_time").default(0),
  eventType: text("event_type").notNull(), // GOAL, YELLOW CARD, RED CARD, SUBSTITUTION, VAR, KICKOFF, HALF TIME, FULL TIME
  teamName: text("team_name").notNull(),
  playerName: text("player_name").notNull(),
  assistName: text("assist_name").default(""),
  description: text("description").notNull(),
  isDevSeed: boolean("is_dev_seed").notNull().default(false),
});

export const matchLineups = pgTable("match_lineups", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  teamName: text("team_name").notNull(),
  formation: text("formation").notNull().default("4-2-3-1"),
  playerName: text("player_name").notNull(),
  squadNumber: integer("squad_number").notNull(),
  position: text("position").notNull(), // GK, RB, CB, LB, CDM, CAM, RW, LW, ST
  isStarter: boolean("is_starter").notNull().default(true),
  isCaptain: boolean("is_captain").notNull().default(false),
  pitchX: integer("pitch_x").notNull().default(50),
  pitchY: integer("pitch_y").notNull().default(50),
  isDevSeed: boolean("is_dev_seed").notNull().default(false),
});

export const competitionStandings = pgTable("competition_standings", {
  id: serial("id").primaryKey(),
  competitionCode: text("competition_code").notNull().default("SUPER_LIG"),
  competitionName: text("competition_name").notNull().default("Trendyol Süper Lig"),
  season: text("season").notNull().default("2026/27"),
  position: integer("position").notNull(),
  teamName: text("team_name").notNull(),
  played: integer("played").notNull(),
  won: integer("won").notNull(),
  drawn: integer("drawn").notNull(),
  lost: integer("lost").notNull(),
  goalsFor: integer("goals_for").notNull(),
  goalsAgainst: integer("goals_against").notNull(),
  goalDifference: integer("goal_difference").notNull(),
  points: integer("points").notNull(),
  dataSource: text("data_source").notNull().default("Authorized Club Database"),
  updatedAt: timestamp("updated_at").defaultNow(),
  isDevSeed: boolean("is_dev_seed").notNull().default(false),
});

export const footballApiConfigs = pgTable("football_api_configs", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("api-football"), // api-football, football-data
  baseUrl: text("base_url").notNull().default("https://v3.football.api-sports.io"),
  teamId: text("team_id").notNull().default("645"), // 645 = Galatasaray in API-Football
  competitionIds: text("competition_ids").notNull().default("203,2"), // 203 = Süper Lig, 2 = Champions League
  timezone: text("timezone").notNull().default("Europe/Istanbul"),
  pollingIntervalSec: integer("polling_interval_sec").notNull().default(60),
  matchDayModeOverride: boolean("match_day_mode_override").notNull().default(false),
  lastSuccessfulSyncAt: text("last_successful_sync_at").default(""),
  lastFailedSyncAt: text("last_failed_sync_at").default(""),
  lastResponseLatencyMs: integer("last_response_latency_ms").default(0),
  errorCount: integer("error_count").notNull().default(0),
  lastSafeError: text("last_safe_error").default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const meetSessions = pgTable("meet_sessions", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  playerName: text("player_name").notNull(),
  sessionType: text("session_type").notNull(), // Virtual Meet and Greet, Private Video Session, Signed Merchandise Session, Fan Event, Training Ground Experience, VIP Matchday Experience
  sessionDate: text("session_date").notNull(),
  sessionTime: text("session_time").notNull(),
  capacity: integer("capacity").notNull().default(10),
  bookedCount: integer("booked_count").notNull().default(0),
  priceEur: numeric("price_eur", { precision: 10, scale: 2 }).notNull(),
  location: text("location").notNull(),
  status: text("status").notNull().default("Available"), // Available, Full, Blocked
  isDevSeed: boolean("is_dev_seed").notNull().default(false),
});

export const meetBookings = pgTable("meet_bookings", {
  id: serial("id").primaryKey(),
  bookingReference: text("booking_reference").notNull().unique(),
  sessionId: integer("session_id").notNull(),
  userUid: text("user_uid").notNull(),
  fanName: text("fan_name").notNull(),
  fanEmail: text("fan_email").notNull(),
  participants: integer("participants").notNull().default(1),
  membershipTier: text("membership_tier").notNull().default("NONE"),
  specialRequest: text("special_request").default(""),
  totalPaidEur: numeric("total_paid_eur", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("Confirmed"), // Pending, Payment Pending, Confirmed, Rescheduled, Completed, Cancelled, Refunded
  createdAt: timestamp("created_at").defaultNow(),
});

export const academyApplications = pgTable("academy_applications", {
  id: serial("id").primaryKey(),
  applicationCode: text("application_code").notNull().unique(),
  userUid: text("user_uid").notNull(),
  applicantName: text("applicant_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  nationality: text("nationality").notNull(),
  country: text("country").notNull(),
  currentClub: text("current_club").notNull(),
  position: text("position").notNull(),
  preferredFoot: text("preferred_foot").notNull(), // Right, Left, Both
  heightCm: integer("height_cm").notNull(),
  weightKg: integer("weight_kg").notNull(),
  playingLevel: text("playing_level").notNull(),
  experienceSummary: text("experience_summary").notNull(),
  guardianName: text("guardian_name").default(""),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  highlightVideoUrl: text("highlight_video_url").default(""),
  documentCvName: text("document_cv_name").default(""),
  medicalDeclaration: boolean("medical_declaration").notNull().default(true),
  personalStatement: text("personal_statement").notNull(),
  status: text("status").notNull().default("Submitted"), // Submitted, Under Review, Shortlisted, Additional Information Required, Trial Invitation, Rejected, Accepted, Archived
  scoutScore: integer("scout_score").default(0),
  assignedScout: text("assigned_scout").default("Unassigned"),
  internalNotes: text("internal_notes").default(""),
  createdAt: timestamp("created_at").defaultNow(),
  isDevSeed: boolean("is_dev_seed").notNull().default(false),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(), // Official Jerseys, Player Worn Jerseys, Signed Jerseys, Training Wear, Scarves, Caps, Accessories, Collectibles, Limited Edition Items, Memorabilia
  description: text("description").notNull(),
  priceEur: numeric("price_eur", { precision: 10, scale: 2 }).notNull(),
  stockQuantity: integer("stock_quantity").notNull().default(25),
  sizes: jsonb("sizes").$type<string[]>().notNull(),
  condition: text("condition").notNull().default("New Official"),
  authenticityCode: text("authenticity_code").notNull(),
  imageUrl: text("image_url").notNull(),
  featured: boolean("featured").notNull().default(false),
  isDevSeed: boolean("is_dev_seed").notNull().default(false),
});

export const auctions = pgTable("auctions", {
  id: serial("id").primaryKey(),
  itemTitle: text("item_title").notNull(),
  playerName: text("player_name").notNull(),
  matchFixture: text("match_fixture").notNull(),
  competition: text("competition").notNull(),
  season: text("season").notNull(),
  matchDate: text("match_date").notNull(),
  itemCondition: text("item_condition").notNull(),
  certificateNumber: text("certificate_number").notNull().unique(),
  startingPriceEur: numeric("starting_price_eur", { precision: 10, scale: 2 }).notNull(),
  reservePriceEur: numeric("reserve_price_eur", { precision: 10, scale: 2 }).notNull(),
  bidIncrementEur: numeric("bid_increment_eur", { precision: 10, scale: 2 }).notNull().default("50.00"),
  currentHighestBidEur: numeric("current_highest_bid_eur", { precision: 10, scale: 2 }).notNull(),
  highestBidderUid: text("highest_bidder_uid").default(""),
  highestBidderName: text("highest_bidder_name").default("Opening Reserve"),
  bidCount: integer("bid_count").notNull().default(0),
  endsAt: timestamp("ends_at").notNull(),
  status: text("status").notNull().default("Open"), // Open, Paused, Closed, Sold, Cancelled
  imageUrl: text("image_url").notNull(),
  isDevSeed: boolean("is_dev_seed").notNull().default(false),
});

export const auctionBids = pgTable("auction_bids", {
  id: serial("id").primaryKey(),
  auctionId: integer("auction_id").notNull(),
  userUid: text("user_uid").notNull(),
  bidderName: text("bidder_name").notNull(),
  bidAmountEur: numeric("bid_amount_eur", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  userUid: text("user_uid").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  shippingAddress: text("shipping_address").notNull(),
  shippingCity: text("shipping_city").notNull(),
  shippingCountry: text("shipping_country").notNull(),
  shippingMethod: text("shipping_method").notNull(), // Standard International, Express Priority, Domestic Courier
  paymentProvider: text("payment_provider").notNull(), // Stripe, PayPal, Bank Transfer
  paymentIntentId: text("payment_intent_id").notNull(),
  items: jsonb("items").$type<Array<{ productId: number; name: string; size: string; qty: number; priceEur: number }>>().notNull(),
  subtotalEur: numeric("subtotal_eur", { precision: 10, scale: 2 }).notNull(),
  shippingCostEur: numeric("shipping_cost_eur", { precision: 10, scale: 2 }).notNull(),
  taxEur: numeric("tax_eur", { precision: 10, scale: 2 }).notNull(),
  discountEur: numeric("discount_eur", { precision: 10, scale: 2 }).notNull().default("0.00"),
  totalEur: numeric("total_eur", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("Pending"), // Pending, Payment Processing, Paid, Processing, Packed, Shipped, In Transit, Delivered, Cancelled, Refunded
  trackingNumber: text("tracking_number").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shipments = pgTable("shipments", {
  id: serial("id").primaryKey(),
  trackingNumber: text("tracking_number").notNull().unique(),
  orderNumber: text("order_number").notNull(),
  userUid: text("user_uid").notNull(),
  recipientName: text("recipient_name").notNull(),
  originFacility: text("origin_facility").notNull().default("Istanbul Global Logistics Hub, TR"),
  currentLocation: text("current_location").notNull().default("Istanbul Global Logistics Hub, TR"),
  destinationCity: text("destination_city").notNull(),
  destinationCountry: text("destination_country").notNull(),
  courierProvider: text("courier_provider").notNull().default("Galatasaray Global Express (DHL Air Bridge)"),
  serviceLevel: text("service_level").notNull().default("Express Priority"),
  weightKg: numeric("weight_kg", { precision: 6, scale: 2 }).notNull().default("0.85"),
  dimensionsCm: text("dimensionsCm").notNull().default("38x28x8 cm"),
  estimatedDelivery: text("estimated_delivery").notNull(),
  status: text("status").notNull().default("Preparing Shipment"), // Order Received, Payment Confirmed, Preparing Shipment, Package Collected, Origin Facility, International Transit, Destination Facility, Customs Processing, Out for Delivery, Delivered
  originLat: numeric("origin_lat", { precision: 8, scale: 4 }).notNull().default("41.0082"),
  originLng: numeric("origin_lng", { precision: 8, scale: 4 }).notNull().default("28.9784"),
  currentLat: numeric("current_lat", { precision: 8, scale: 4 }).notNull().default("41.0082"),
  currentLng: numeric("current_lng", { precision: 8, scale: 4 }).notNull().default("28.9784"),
  destLat: numeric("dest_lat", { precision: 8, scale: 4 }).notNull().default("51.5074"),
  destLng: numeric("dest_lng", { precision: 8, scale: 4 }).notNull().default("-0.1278"),
  dataSourceMode: text("data_source_mode").notNull().default("Admin Controlled Milestone"), // Live Carrier API, Admin Controlled Milestone
  updatedAt: timestamp("updated_at").defaultNow(),
  isDevSeed: boolean("is_dev_seed").notNull().default(false),
});

export const trackingEvents = pgTable("tracking_events", {
  id: serial("id").primaryKey(),
  trackingNumber: text("tracking_number").notNull(),
  stage: text("stage").notNull(),
  facility: text("facility").notNull(),
  description: text("description").notNull(),
  eventTimestamp: text("event_timestamp").notNull(),
});

export const cmsArticles = pgTable("cms_articles", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  category: text("category").notNull(), // News, Match Report, Academy Announcement, Membership Campaign, Store Release, Legal
  summary: text("summary").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("Published"), // Draft, Published, Scheduled, Archived
  metaTitle: text("meta_title").notNull(),
  metaDescription: text("meta_description").notNull(),
  publishedAt: text("published_at").notNull(),
  isDevSeed: boolean("is_dev_seed").notNull().default(false),
});

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: text("ticket_number").notNull().unique(),
  userUid: text("user_uid").notNull(),
  requesterName: text("requester_name").notNull(),
  requesterEmail: text("requester_email").notNull(),
  category: text("category").notNull(), // Order Support, Membership Support, Shipping Support, Academy Support, Booking Support
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  priority: text("priority").notNull().default("Normal"), // Low, Normal, High, Urgent
  status: text("status").notNull().default("Open"), // Open, Pending, In Progress, Resolved, Closed
  adminReply: text("admin_reply").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  adminEmail: text("admin_email").notNull(),
  action: text("action").notNull(),
  affectedEntity: text("affected_entity").notNull(),
  previousValue: text("previous_value").default(""),
  newValue: text("new_value").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const siteConfigurations = pgTable("site_configurations", {
  id: serial("id").primaryKey(),
  configKey: text("config_key").notNull().unique(),
  configValue: text("config_value").notNull(),
  category: text("category").notNull(), // Brand, Payment, Shipping, Email, Security
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userUid: text("user_uid").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  channel: text("channel").notNull().default("In-Dashboard"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const integrationStatuses = pgTable("integration_statuses", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().unique(), // stripe, paypal, dhl, smtp
  environmentMode: text("environment_mode").notNull().default("test"), // sandbox, live, test, production
  connectionStatus: text("connection_status").notNull().default("Not Tested"), // Operational, Configuration Warning, Connection Failed, Not Tested
  lastSuccessfulTestAt: text("last_successful_test_at").default(""),
  lastAttemptAt: text("last_attempt_at").default(""),
  safeErrorDescription: text("safe_error_description").default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const newsletterSubscriptions = pgTable("newsletter_subscriptions", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  supporterName: text("supporter_name").default("Global Supporter"),
  country: text("country").default("International"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});


