ALTER TABLE kyc_verifications
  DROP CONSTRAINT IF EXISTS kyc_verifications_status_check;

ALTER TABLE kyc_verifications
  ADD CONSTRAINT kyc_verifications_status_check
  CHECK (status IN ('verified', 'manual_review', 'rejected'));
