-- Retire the discount/referral system (removed from code in PR #56/#58).
-- The API no longer reads or writes any of these tables or settings; this
-- script removes the orphaned objects from the database.
--
-- Run in the Supabase SQL editor (or psql) when ready. Section 1 is
-- read-only — run it first and eyeball the output before running the
-- destructive sections. Dropped data is unrecoverable.

-- ── 1. AUDIT (read-only) ─────────────────────────────────────────────────────

-- What the referral tables still hold:
SELECT 'referral_codes'       AS tbl, COUNT(*) FROM referral_codes
UNION ALL SELECT 'referral_signups',      COUNT(*) FROM referral_signups
UNION ALL SELECT 'referral_conversions',  COUNT(*) FROM referral_conversions
UNION ALL SELECT 'referral_discounts',    COUNT(*) FROM referral_discounts;

-- Legacy free-tier-era subscriptions. plan='free' rows are already inert
-- (code resolves them to no-plan), but ACTIVE 'starter' rows with no paid
-- period end still grant Starter access — review these and expire any that
-- have no matching completed payment:
SELECT s.user_id, s.plan, s.status, s.gateway, s.current_period_end, s.created_at,
       (SELECT COUNT(*) FROM payments p
         WHERE p.user_id = s.user_id AND p.type = 'subscription' AND p.status = 'completed') AS paid_subscription_payments
FROM user_subscriptions s
WHERE s.plan IN ('free', 'starter', 'starter_monthly')
ORDER BY paid_subscription_payments ASC, s.created_at DESC;

-- ── 2. DROP the orphaned referral tables ─────────────────────────────────────

DROP TABLE IF EXISTS referral_discounts;
DROP TABLE IF EXISTS referral_conversions;
DROP TABLE IF EXISTS referral_signups;
DROP TABLE IF EXISTS referral_codes;

-- ── 3. Remove orphaned referral settings keys ────────────────────────────────
-- (The seeder no longer inserts these; existing rows just linger.)

DELETE FROM system_settings
WHERE key IN ('referral_referrer_pct', 'referral_friend_pct', 'referral_commission_pct');

-- ── 4. OPTIONAL: expire unpaid legacy free-tier subscriptions ────────────────
-- Review the audit in section 1 before running. This expires 'free' rows
-- (already inert to the app) and any active starter rows that have never
-- had a completed subscription payment (i.e. comped during the free-tier
-- era). Deliberately excludes admin-granted plans you want to keep — edit
-- the WHERE clause if you have intentional comps.

-- UPDATE user_subscriptions s
-- SET status = 'expired', updated_at = NOW()
-- WHERE s.plan IN ('free', 'starter', 'starter_monthly')
--   AND s.status = 'active'
--   AND NOT EXISTS (
--     SELECT 1 FROM payments p
--     WHERE p.user_id = s.user_id AND p.type = 'subscription' AND p.status = 'completed'
--   );
