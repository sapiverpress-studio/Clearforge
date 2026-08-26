const SCOPE_PATTERNS = [
  /\b(?:ai|artificial intelligence|machine learning|llm|large language model|generative ai|chatbot|agentic|foundation model)\b/i,
  /\b(?:technology|tech|software|hardware|semiconductor|chip|gpu|computing|computer|cloud|data centre|data center|datacentre|server|api|developer|open source|browser|search engine)\b/i,
  /\b(?:cyber|cybersecurity|security breach|data breach|privacy|encryption|digital identity|age verification|online safety)\b/i,
  /\b(?:internet|online platform|social media|app|smartphone|device|wearable|robot|robotics|automation|autonomous|quantum|satellite|telecom|fintech|biotech|medtech|electric vehicle|battery technology)\b/i,
  /\b(?:startup|venture capital|venture funding|funding round|series [a-z]|tech investment|technology investment|digital business|platform economy)\b/i,
  /\b(?:apple|nvidia|openai|anthropic|meta|google|alphabet|microsoft|amazon|aws|perplexity|xai|tesla|tsmc|amd|intel|salesforce|adobe|oracle|ibm|hugging face|tiktok|bytedance|spacex)\b/i
];

export function isEditoriallyRelevant(candidate = {}) {
  const text = [
    candidate.title,
    candidate.summary,
    candidate.publisher,
    candidate.source
  ].filter(Boolean).join(" ");
  return SCOPE_PATTERNS.some((pattern) => pattern.test(text));
}

export function stripOurReadPrefix(value) {
  return String(value ?? "")
    .replace(/^\s*our\s+read(?:\s+is)?(?:\s+that)?\s*:?\s*/i, "")
    .trim();
}

export const __test = { SCOPE_PATTERNS };
