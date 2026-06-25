/** Default trial length for new agency signups (days). Override via TRIAL_DAYS in .env */
function getTrialDays() {
  const raw = parseInt(String(process.env.TRIAL_DAYS || "7"), 10);
  if (!Number.isFinite(raw) || raw < 0) return 7;
  return Math.min(raw, 90);
}

function addTrialExpiry(fromDate = new Date()) {
  const end = new Date(fromDate);
  end.setDate(end.getDate() + getTrialDays());
  return end;
}

module.exports = { getTrialDays, addTrialExpiry };
