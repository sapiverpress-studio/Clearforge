const ENTITY_STOPWORDS = new Set([
  "A", "An", "And", "As", "At", "By", "For", "From", "How", "In", "Into", "Is", "It", "Its",
  "Of", "On", "Or", "That", "The", "This", "To", "What", "When", "Where", "Which", "Who", "Why", "With"
]);
const GENERIC_SENTENCE_STARTS = new Set([
  "According", "Although", "Attributing", "Compared", "Consequently", "Following", "However", "Overall", "Respondents"
]);

export function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)));
}

export function extractUsableText(html) {
  return decodeEntities(String(html || "")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<(script|style|svg|noscript|template|nav|header|footer|aside|form|button)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(?:p|div|article|section|main|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/\bShare\s+Share\s+on\s+Twitter\s+LinkedIn\s+Email\b/gi, " ")
    .replace(/[ \t]+/g, " ").replace(/ *\n+ */g, "\n").trim();
}

const BOILERPLATE_PATTERNS = [
  /\bskip to content\b/i, /\b(?:log in|create account|sign in|sign up)\b/i,
  /\badd reaction\b/i, /\b(?:like|unicorn|exploding head|raised hands|fire)\b/i,
  /\bjump to comments\b/i, /\b(?:save|boost|copy link|copied to clipboard)\b/i,
  /\bshare to (?:x|linkedin|facebook|mastodon)\b/i, /\breport abuse\b/i,
  /\bshare\s+share\s+on\s+twitter\b/i, /\btwitter\s+linkedin\s+email\b/i,
  /\bsubscribe\b/i, /\bcode of conduct\b/i, /\bprivacy policy\b/i
];

export function isMeaningfulEvidencePassage(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const boilerplateHits = BOILERPLATE_PATTERNS.filter((pattern) => pattern.test(text)).length;
  if (wordCount < 6 || text.length > 900 || boilerplateHits >= 2) return false;
  if (/^(?:home|about|contact|menu|comments?|share|follow|advertise|more from)\b/i.test(text)) return false;
  return /\b(?:is|are|was|were|has|have|had|requires?|must|should|found|reported|published|applies?|changed|reviewed|generated|disclosed?|describes?|states?|says?|announced|introduces?|uses?|moves?|moving|redesigned?|enabled?)\b/i.test(text);
}

export function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9%£$€.'-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function extractMaterialNumbers(value) {
  return [...new Set(String(value || "").match(/(?<![\w])\d+(?:[,.]\d+)*(?:\s?(?:%|percent|million|billion|thousand|bn|m|k))?/gi) || [])]
    .map((item) => normalizeText(item).replace(/,/g, ""))
    .filter((item) => item && !/^20\d{2}$/.test(item));
}

export function extractDates(value) {
  const text = String(value || "");
  return [...new Set([
    ...(text.match(/\b(?:\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+20\d{2})?|(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+(?:20\d{2}|\d{1,2}(?:,?\s+20\d{2})?))?)/g) || []),
    ...(text.match(/\b20\d{2}-\d{2}-\d{2}\b/g) || [])
  ])];
}

export function extractQuotedWording(value) {
  return [...new Set([...String(value || "").matchAll(/[“"]([^”"]{3,160})[”"]/g)].map((match) => match[1].trim()))];
}

export function extractEntities(value) {
  const matches = String(value || "").match(/\b[A-Z][A-Za-z0-9.+&-]*(?:\s+(?:[A-Z][A-Za-z0-9.+&-]*|of|and|for|the)){0,4}\b/g) || [];
  return [...new Set(matches.map((item) => item.trim()).filter((item) => {
    if (ENTITY_STOPWORDS.has(item)) return false;
    if (GENERIC_SENTENCE_STARTS.has(item)) return false;
    if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/.test(item)) return false;
    return item.length > 2;
  }))];
}

export function splitSentences(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  const protectedText = text
    .replace(/https?:\/\/[^\s]+/gi, (match) => match.replaceAll(".", "\uE000"))
    .replace(/(?<=\d)\.(?=\d)/g, "\uE000")
    .replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|e\.g|i\.e)\./gi, (match) => match.replaceAll(".", "\uE000"));
  return (protectedText.match(/[^.!?]+[.!?]?/g) || [])
    .map((item) => item.replaceAll("\uE000", ".").trim())
    .filter(Boolean);
}

export function splitAtomicClaims(value) {
  const claims = [];
  for (const sentence of splitSentences(value)) {
    const pieces = sentence
      .split(/\s*(?:;|,(?=\s+(?:and|but|while|with|across|in a|based on))|\band\s+(?=(?:the|this|that|it|was|were|is|are|covered|included|accounted|represented|measured|found|reported|showed|compared))|\bwhile\b|\bwhereas\b)\s*/i)
      .map((item) => item.trim().replace(/^[,;]\s*/, "")).filter((item) => item.length > 8);
    claims.push(...(pieces.length ? pieces : [sentence]));
  }
  return [...new Set(claims)];
}

function tokens(value) {
  return normalizeText(value).split(" ").map((token) => token.replace(/^[.'-]+|[.'-]+$/g, ""))
    .filter((token) => token.length > 2 && !/^(the|and|that|with|from|into|this|were|was|are|for|has|have|had|its|their|than)$/.test(token));
}

function comparisonMarkers(value) {
  return [...new Set(String(value || "").toLowerCase().match(/\b(?:twice|double|half|more than|less than|higher than|lower than|faster than|slower than|most|least|largest|smallest)\b/g) || [])];
}

function evidenceCandidates(sourceText) {
  const sentences = splitSentences(sourceText);
  const windows = sentences.flatMap((sentence, index) => [sentence, index + 1 < sentences.length ? `${sentence} ${sentences[index + 1]}` : ""]);
  return [...new Set(windows)].filter((passage) => passage.length >= 25 && passage.length <= 1200 && isMeaningfulEvidencePassage(passage));
}

export function verifyAtomicClaim(claim, sourceText) {
  const normalizedSource = normalizeText(sourceText);
  const numbers = extractMaterialNumbers(claim);
  const dates = extractDates(claim);
  const entities = extractEntities(claim);
  const comparisons = comparisonMarkers(claim);
  const quotes = extractQuotedWording(claim);
  const claimTokens = [...new Set(tokens(claim))];
  let best = { passage: "", score: 0, start: -1, end: -1 };
  for (const passage of evidenceCandidates(sourceText)) {
    const passageTokens = new Set(tokens(passage));
    const normalizedPassage = normalizeText(passage);
    const requiredSpecifics = [...numbers, ...dates, ...comparisons, ...quotes].map(normalizeText);
    const hasSpecifics = requiredSpecifics.every((value) => normalizedPassage.includes(value));
    const carrier = splitSentences(passage).find((sentence) => requiredSpecifics.every((value) => normalizeText(sentence).includes(value))) || "";
    const carrierTokens = new Set(tokens(carrier));
    const carrierOverlap = claimTokens.filter((token) => carrierTokens.has(token)).length;
    const specificsAreContextual = !requiredSpecifics.length || carrierOverlap >= 2;
    const score = hasSpecifics && specificsAreContextual && claimTokens.length ? claimTokens.filter((token) => passageTokens.has(token)).length / claimTokens.length : 0;
    if (score > best.score) {
      const start = sourceText.indexOf(passage);
      best = { passage, score, start, end: start < 0 ? -1 : start + passage.length };
    }
  }
  const exact = normalizedSource.includes(normalizeText(claim));
  const evidenceText = exact ? claim : best.passage;
  const normalizedEvidence = normalizeText(evidenceText);
  const checks = {
    numbers: numbers.map((value) => ({ value, supported: normalizedEvidence.includes(value) })),
    dates: dates.map((value) => ({ value, supported: normalizedEvidence.includes(normalizeText(value)) })),
    entities: entities.map((value) => ({ value, supported: normalizedEvidence.includes(normalizeText(value)) })),
    comparisons: comparisons.map((value) => ({ value, supported: normalizedEvidence.includes(normalizeText(value)) })),
    quotes: quotes.map((value) => ({ value, supported: normalizedEvidence.includes(normalizeText(value)) }))
  };
  const deterministicPass = Object.values(checks).flat().every((check) => check.supported);
  const materialSpecificPresent = numbers.length + dates.length + comparisons.length + quotes.length > 0;
  const lexicalThreshold = materialSpecificPresent ? 0.22 : claimTokens.length <= 5 ? 0.8 : 0.62;
  const lexicalEntailment = exact || best.score >= lexicalThreshold;
  const supported = Boolean(sourceText.trim()) && deterministicPass && lexicalEntailment;
  const failedChecks = Object.entries(checks).flatMap(([kind, values]) => values.filter((item) => !item.supported).map((item) => `${kind}:${item.value}`));
  if (!lexicalEntailment) failedChecks.push(`entailment:token-overlap-${best.score.toFixed(2)}`);
  return { supported, exact, evidence: best, checks, failed_checks: failedChecks };
}

export function buildVerifiedClaims(proposedFact, sourceText, fallbackContext = "") {
  const atomic = splitAtomicClaims(proposedFact).map((claim) => ({ claim, ...verifyAtomicClaim(claim, sourceText) }));
  const verified = atomic.filter((item) => item.supported);
  const fallbackContexts = (Array.isArray(fallbackContext) ? fallbackContext : [fallbackContext]).map(String).filter((item) => item.trim());
  if (!verified.length && sourceText.trim() && fallbackContexts.length) {
    const contextTokenSets = fallbackContexts.map((context) => [...new Set(tokens(context))]).filter((items) => items.length);
    const ranked = evidenceCandidates(sourceText).map((sentence) => {
      const sentenceTokens = new Set(tokens(sentence));
      const score = Math.max(0, ...contextTokenSets.map((contextTokens) => contextTokens.filter((token) => sentenceTokens.has(token)).length / contextTokens.length));
      return { sentence, score };
    }).sort((a, b) => b.score - a.score);
    const fallback = ranked[0]?.score >= 0.3 && isMeaningfulEvidencePassage(ranked[0].sentence) ? ranked[0].sentence : "";
    if (fallback) {
      const start = sourceText.indexOf(fallback);
      const exactVerification = verifyAtomicClaim(fallback, sourceText);
      verified.push({
        claim: fallback, supported: true, exact: true,
        evidence: { passage: fallback, score: 1, start, end: start + fallback.length },
        checks: exactVerification.checks,
        failed_checks: [], qualification: "Narrowed to wording stated directly in the retrieved source because the proposed confirmed fact was unsupported."
      });
    }
  }
  return { atomic, verified };
}

export function evidenceLocation(evidence) {
  return evidence?.start >= 0 ? { type: "character_offsets", start: evidence.start, end: evidence.end } : { type: "unavailable", start: null, end: null };
}
