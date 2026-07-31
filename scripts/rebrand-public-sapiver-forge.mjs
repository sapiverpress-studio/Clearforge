import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "public");
const textExtensions = new Set([
  ".html", ".xml", ".json", ".js", ".css", ".txt", ".md", ".webmanifest", ".svg"
]);

const replacements = [
  [/https:\/\/clearforge-daily-brief\.netlify\.app/g, "https://sapiverforge-daily-brief.netlify.app"],
  [/http:\/\/clearforge-daily-brief\.netlify\.app/g, "https://sapiverforge-daily-brief.netlify.app"],
  [/Clearforge AI Briefing/g, "Sapiver Forge AI Briefing"],
  [/ClearForge AI Briefing/g, "Sapiver Forge AI Briefing"],
  [/Clearforge Applied AI Gate System/g, "Sapiver Forge Applied AI Gate System"],
  [/ClearForge Applied AI Gate System/g, "Sapiver Forge Applied AI Gate System"],
  [/Clearforge AI Gate Workspace/g, "Sapiver Forge AI Gate Workspace"],
  [/ClearForge AI Gate Workspace/g, "Sapiver Forge AI Gate Workspace"],
  [/Clearforge AI Agent Connection Safety Gate/g, "Sapiver Forge AI Agent Connection Safety Gate"],
  [/ClearForge AI Agent Connection Safety Gate/g, "Sapiver Forge AI Agent Connection Safety Gate"],
  [/Clearforge hosted podcast feed/g, "Sapiver Forge hosted podcast feed"],
  [/ClearForge hosted podcast feed/g, "Sapiver Forge hosted podcast feed"],
  [/Clearforge weekly newsletter/g, "Sapiver Forge weekly newsletter"],
  [/ClearForge weekly newsletter/g, "Sapiver Forge weekly newsletter"],
  [/Clearforge weekly digest/g, "Sapiver Forge weekly digest"],
  [/ClearForge weekly digest/g, "Sapiver Forge weekly digest"],
  [/Clearforge product updates/g, "Sapiver Forge product updates"],
  [/ClearForge product updates/g, "Sapiver Forge product updates"],
  [/support Clearforge/g, "support Sapiver Forge"],
  [/Support Clearforge/g, "Support Sapiver Forge"],
  [/Continue with Clearforge/g, "Continue with Sapiver Forge"],
  [/Explore Clearforge topics/g, "Explore Sapiver Forge topics"],
  [/The four Clearforge Gates/g, "The four Sapiver Forge Gates"],
  [/How the Clearforge Gates work/g, "How the Sapiver Forge Gates work"],
  [/No Clearforge account/g, "No Sapiver Forge account"],
  [/from Clearforge/g, "from Sapiver Forge"],
  [/by Clearforge/g, "by Sapiver Forge"],
  [/Clearforge analysis/g, "Sapiver Forge analysis"],
  [/Clearforge explains/g, "Sapiver Forge explains"],
  [/Clearforge guidance/g, "Sapiver Forge guidance"],
  [/Clearforge products/g, "Sapiver Forge products"],
  [/Clearforge product/g, "Sapiver Forge product"],
  [/Clearforge Gates/g, "Sapiver Forge Gates"],
  [/Clearforge Gate/g, "Sapiver Forge Gate"],
  [/Clearforge topics/g, "Sapiver Forge topics"],
  [/Clearforge reports/g, "Sapiver Forge reports"],
  [/Clearforge Features/g, "Sapiver Forge Features"],
  [/Clearforge Podcast/g, "Sapiver Forge Podcast"],
  [/Clearforge/g, "Sapiver Forge"],
  [/ClearForge/g, "Sapiver Forge"],
  [/CLEARFORGE/g, "SAPIVER FORGE"]
];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!textExtensions.has(path.extname(entry.name).toLowerCase())) continue;

    const original = fs.readFileSync(fullPath, "utf8");
    let updated = original;

    // Preserve historical podcast GUIDs so platforms do not import duplicates.
    const guids = [];
    updated = updated.replace(/<guid isPermaLink="false">clearforge:[^<]+<\/guid>/g, (value) => {
      const token = `__PRESERVED_PODCAST_GUID_${guids.length}__`;
      guids.push(value);
      return token;
    });

    for (const [pattern, replacement] of replacements) {
      updated = updated.replace(pattern, replacement);
    }

    guids.forEach((value, index) => {
      updated = updated.replace(`__PRESERVED_PODCAST_GUID_${index}__`, value);
    });

    if (updated !== original) {
      fs.writeFileSync(fullPath, updated, "utf8");
      console.log(`Rebranded ${path.relative(process.cwd(), fullPath)}`);
    }
  }
}

if (!fs.existsSync(root)) {
  throw new Error(`Public directory not found: ${root}`);
}

walk(root);
console.log("Sapiver Forge public-site rebrand pass complete.");
