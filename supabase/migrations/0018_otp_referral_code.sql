-- Carry referral code through signup OTP challenge.
alter table public.otp_challenges
  add column if not exists referral_code text;

