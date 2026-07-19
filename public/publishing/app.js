const repoRoot = "https://raw.githubusercontent.com/sapiverpress-studio/SapiverPress_comic_public/main/";
const status = document.querySelector("#status");
const assetsRoot = document.querySelector("#assets");

function raw(path) { return repoRoot + String(path || "").replace(/^\/+/, ""); }
async function copyText(text, button) {
  await navigator.clipboard.writeText(text);
  const old = button.textContent; button.textContent = "Copied";
  setTimeout(() => { button.textContent = old; }, 1400);
}
async function renderVersion(label, entry) {
  const caption = entry?.caption ? await fetch(raw(entry.caption)).then((response) => response.ok ? response.text() : "") : "";
  const card = document.createElement("article"); card.className = "asset";
  const title = document.createElement("h2"); title.textContent = label; card.append(title);
  const video = document.createElement("video"); video.controls = true; video.preload = "metadata"; video.src = raw(entry.video); card.append(video);
  const box = document.createElement("div"); box.className = "copybox"; box.textContent = caption.trim() || "No caption supplied."; card.append(box);
  const actions = document.createElement("div"); actions.className = "actions";
  const copy = document.createElement("button"); copy.textContent = "Copy caption"; copy.addEventListener("click", () => copyText(caption.trim(), copy)); actions.append(copy);
  const download = document.createElement("a"); download.className = "button"; download.textContent = "Open/download video"; download.href = raw(entry.video); download.target = "_blank"; download.rel = "noopener"; actions.append(download);
  card.append(actions); return card;
}
try {
  const response = await fetch(raw("social/clearforge/latest.json"), { cache: "no-store" });
  if (!response.ok) throw new Error("The first public publishing pack has not been generated yet.");
  const manifest = await response.json();
  const cards = [];
  if (manifest.tiktok?.video) cards.push(await renderVersion("TikTok — short question-first version", manifest.tiktok));
  if (manifest.youtube?.video) cards.push(await renderVersion("YouTube — longer briefing version", manifest.youtube));
  if (!cards.length) throw new Error("The latest run did not contain finished videos.");
  assetsRoot.replaceChildren(...cards);
  status.textContent = `Edition ${manifest.date}. These temporary publishing files are public while the sales test is running.`;
} catch (error) {
  status.textContent = error.message + " Check again after the next successful Clearforge Social Distribution run.";
}
