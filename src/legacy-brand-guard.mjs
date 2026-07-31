const legacyBrandPattern = /\bclear\s*forge\b|\bclearforge\b|https?:\/\/clearforge-daily-brief\.netlify\.app/i;

export function stripAllowedLegacyIdentifiers(value) {
  return String(value ?? "")
    .replace(/<guid\s+isPermaLink=["']false["']>clearforge:[^<]+<\/guid>/gi, "")
    .replace(/\bclearforge@sapiverpress\.co\.uk\b/gi, "")
    .replace(/\bdata-clearforge-[a-z0-9-]+\b/gi, "")
    .replace(/\bsocial\/clearforge\/[a-z0-9._/-]*\b/gi, "")
    .replace(/\bclearforge-weekly-digest\b/gi, "")
    .replace(/https:\/\/music\.amazon\.co\.uk\/podcasts\/[a-z0-9-]+\/clearforge-ai-briefing\b/gi, "")
    .replace(/\bclearforge-weekly-ai-learning-brief-[a-z0-9-]+\.pdf\b/gi, "");
}

export function containsVisibleLegacyBrand(value) {
  return legacyBrandPattern.test(stripAllowedLegacyIdentifiers(value));
}
