-- Optional signup context carried with the OTP challenge (cleared after verify).
alter table public.otp_challenges
  add column if not exists owner_name text,
  add column if not exists school_name text;
