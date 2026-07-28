const absoluteAvailabilityPattern =
  /\b(?:available today|available now|now available|generally available|general availability)\b/i;
const accessQualificationPattern =
  /\b(?:eligible|limited|preview|beta|pilot|rollout|region|regional|account tier|plan|enterprise customers?|selected customers?|managed deployment|deployed product|self[- ]serve|self[- ]service|not (?:yet )?available as a self[- ]serve product)\b/i;
const unsupportedComparisonPattern =
  /\b(?:as much as|faster than|more important than|less important than|matters? more than|matters? less than)\b/i;

export function deterministicQualificationFailure(occurrence) {
  const context = String(occurrence?.context || "");
  if (!absoluteAvailabilityPattern.test(context) || accessQualificationPattern.test(context)) return null;
  return {
    occurrence_id: occurrence.id,
    status: "needs_qualification",
    reason: "Absolute availability wording is present without a material eligibility, programme, tier, region, deployment or self-service qualification in the same statement.",
    required_correction: "State who can access the product and preserve any limited programme, preview, account-tier, regional, managed-deployment and self-service restrictions from the primary source.",
    source_url: ""
  };
}

export function deterministicInferenceFailure(occurrence) {
  const context = String(occurrence?.context || "");
  if (!unsupportedComparisonPattern.test(context)) return null;
  return {
    occurrence_id: occurrence.id,
    status: "overstated",
    reason: "The statement makes a comparative claim that must not pass without direct quantitative evidence.",
    required_correction: "Remove the comparison and rewrite it as a proportionate, explicitly framed interpretation unless the cited primary source directly measures the comparison.",
    source_url: ""
  };
}

export function applyDeterministicGuards(occurrences, audits, guard) {
  const byId = new Map((audits || []).map((item) => [item.occurrence_id, item]));
  return occurrences.map((occurrence) => {
    const deterministicFailure = guard(occurrence);
    const modelAudit = byId.get(occurrence.id);
    if (!deterministicFailure) return modelAudit;
    return {
      ...modelAudit,
      ...deterministicFailure,
      source_url: modelAudit?.source_url || deterministicFailure.source_url
    };
  }).filter(Boolean);
}
