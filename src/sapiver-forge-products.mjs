export const SITE_BASE = "https://sapiverforge-daily-brief.netlify.app";

export const products = [
  {
    slug: "opportunity-gate",
    stage: "Gate 1",
    name: "Sapiver Forge AI Opportunity Gate",
    shortName: "Opportunity Gate",
    version: "1.0.1",
    question: "Should AI be considered for this task?",
    description: "A practical decision tool for testing whether AI is suitable, worthwhile and appropriately bounded before time, money or sensitive information is committed.",
    contents: ["Standalone local-first HTML decision tool", "Supporting workbook", "Completed example", "Quick-start guidance"],
    price: "22.80",
    checkoutUrl: "https://payhip.com/b/4rcSt",
    image: "/products/gate-system/opportunity-gate/01_Cover.webp"
  },
  {
    slug: "workflow-control-gate",
    stage: "Gate 2",
    name: "Sapiver Forge AI Workflow Control Gate",
    shortName: "Workflow Control Gate",
    version: "1.0.2",
    question: "Is the proposed workflow properly bounded and ready to operate?",
    description: "A practical control tool for defining ownership, boundaries, approval points, evidence requirements and fallback routes before an AI-assisted workflow begins operating.",
    contents: ["Standalone local-first HTML control tool", "Supporting workbook", "Completed example", "Quick-start guidance"],
    price: "22.80",
    checkoutUrl: "https://payhip.com/b/qBPip",
    image: "/products/gate-system/workflow-control-gate/01_Cover.webp"
  },
  {
    slug: "output-release-gate",
    stage: "Gate 3",
    name: "Sapiver Forge AI Output Release Gate",
    shortName: "Output Release Gate",
    version: "1.2.4",
    question: "Is this exact consequential output ready to leave?",
    description: "A structured final checkpoint for checking evidence, names, dates, figures, links, privacy, ownership, disclosure and release readiness before AI-assisted work is published, sent or used.",
    contents: ["Standalone local-first HTML release tool", "Detailed 11-page handbook", "Built-in decision record", "Print-ready review output"],
    price: "22.80",
    checkoutUrl: "https://payhip.com/b/pkSEY",
    image: "/products/gate-system/output-release-gate/01_Cover.webp"
  },
  {
    slug: "outcome-review-gate",
    stage: "Gate 4",
    name: "Sapiver Forge AI Outcome Review Gate",
    shortName: "Outcome Review Gate",
    version: "1.0.1",
    question: "Is the operating workflow delivering worthwhile results?",
    description: "A practical review tool for comparing expected and actual outcomes and deciding whether to continue, change, pause or retire an AI-assisted workflow.",
    contents: ["Standalone local-first HTML review tool", "Supporting workbook", "Completed example", "Quick-start guidance"],
    price: "22.80",
    checkoutUrl: "https://payhip.com/b/rgFXP",
    image: "/products/gate-system/outcome-review-gate/01_Cover.webp"
  }
];

export const bundle = {
  slug: "complete-gate-system",
  name: "Sapiver Forge Applied AI Gate System — Complete Bundle",
  version: "2.3",
  description: "The complete four-stage Sapiver Forge Applied AI Gate System, plus the bundle-exclusive Sapiver Forge AI Agent & Connector Safety Add-on.",
  price: "58.80",
  checkoutUrl: "https://payhip.com/b/cmklU",
  image: "/products/gate-system/complete-bundle/01_Cover.webp",
  contents: [
    "All four standalone Sapiver Forge AI Gates",
    "Supporting workbooks, handbooks, examples and quick-start material supplied with the relevant Gate",
    "Bundle-exclusive Sapiver Forge AI Agent & Connector Safety Add-on v1.0.2"
  ]
};

export const addon = {
  name: "Sapiver Forge AI Agent & Connector Safety Add-on",
  version: "1.0.2",
  question: "Are capability, authority and live-system actions properly controlled?",
  description: "A bundle-exclusive specialist extension for reviewing capability, permitted authority, approval thresholds, action limits, stopping, revocation, rollback and logging when AI is connected to live business systems.",
  note: "This is not a fifth Gate. It is used alongside the Workflow Control Gate when live systems, agents or connectors are involved."
};

export const workspace = {
  slug: "notion-workspace",
  name: "Sapiver Forge AI Gate Workspace",
  description: "A connected Notion workspace for recording assessments, decisions, conditions, owners and follow-up actions across the four Gate stages.",
  price: "19.00",
  checkoutUrl: "https://payhip.com/b/gq89f",
  freeUrl: "https://sapiver-press.kit.com/5147ce2817",
  image: "/products/notion-workspace/01_Cover.webp"
};
