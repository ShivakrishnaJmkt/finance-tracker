export const calculatePolicyNetValue = (policy = {}) => {
  const totalPaid = Number(policy.totalPaid ?? policy.premiumPaid ?? 0);
  const estimatedBonus = Number(
    policy.estimatedBonus ?? policy.bonusEstimate ?? 0
  );
  const maturityValue = Number(policy.maturityValue ?? 0);
  const status = String(policy.policyStatus ?? "Active");

  if (status === "Closed") return 0;

  if (status === "Matured") {
    return Math.max(0, maturityValue);
  }

  return Math.max(0, totalPaid * 0.7 + estimatedBonus * 0.3);
};

export const getMaturityValue = (policy = {}) => {
  return Number(policy.maturityValue ?? 0);
};