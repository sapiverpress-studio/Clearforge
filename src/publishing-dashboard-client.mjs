import { acceptInvite, getUser, handleAuthCallback, login, logout } from "@netlify/identity";

const loginPanel = document.querySelector("#login");
const dashboard = document.querySelector("#dashboard");
const invitePanel = document.querySelector("#invite");
const message = document.querySelector("#login-message");
const assetsRoot = document.querySelector("#assets");
const editionSelect = document.querySelector("#edition");

function showAuth(user) {
  invitePanel.hidden = true;
  loginPanel.hidden = Boolean(user);
  dashboard.hidden = !user;
}
async function api(path) {
  const response = await fetch(path, { credentials: "include" });
  if (response.status === 401) { showAuth(null); throw new Error("Please sign in again."); }
  if (!response.ok) throw new Error(await response.text() || "Request failed.");
  return response.json();
}
function assetUrl(asset, edition, download = false) {
  return `/api/publishing/assets/${encodeURIComponent(asset.id)}?edition=${encodeURIComponent(edition)}${download ? "&download=1" : ""}`;
}
async function copyText(text, button) {
  await navigator.clipboard.writeText(text);
  const old = button.textContent; button.textContent = "Copied";
  setTimeout(() => { button.textContent = old; }, 1400);
}
function renderAsset(asset, manifest) {
  const card = document.createElement("article"); card.className = "asset";
  const title = document.createElement("h2"); title.textContent = asset.label; card.append(title);
  if (asset.kind === "video") {
    const video = document.createElement("video"); video.controls = true; video.preload = "metadata";
    video.src = assetUrl(asset, manifest.edition); card.append(video);
  } else if (asset.kind === "image") {
    const img = document.createElement("img"); img.loading = "lazy"; img.alt = asset.label;
    img.src = assetUrl(asset, manifest.edition); card.append(img);
  } else {
    const box = document.createElement("div"); box.className = "copybox"; box.textContent = asset.text || ""; card.append(box);
  }
  const actions = document.createElement("div"); actions.className = "actions";
  if (asset.kind === "text") {
    const copy = document.createElement("button"); copy.textContent = "Copy";
    copy.addEventListener("click", () => copyText(asset.text || "", copy)); actions.append(copy);
  }
  const download = document.createElement("a"); download.className = "button"; download.textContent = "Download";
  download.href = assetUrl(asset, manifest.edition, true); actions.append(download); card.append(actions);
  return card;
}
async function loadManifest(edition = "latest") {
  assetsRoot.textContent = "Loading publishing pack…";
  const manifest = await api(`/api/publishing/manifest?edition=${encodeURIComponent(edition)}`);
  editionSelect.replaceChildren(...manifest.editions.map((id) => {
    const option = document.createElement("option"); option.value = id; option.textContent = id;
    option.selected = id === manifest.edition; return option;
  }));
  assetsRoot.replaceChildren(...manifest.assets.map((asset) => renderAsset(asset, manifest)));
}
let inviteToken = "";
document.querySelector("#invite-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = document.querySelector("#invite-password").value;
  const confirmation = document.querySelector("#invite-confirm").value;
  const inviteMessage = document.querySelector("#invite-message");
  if (password !== confirmation) { inviteMessage.textContent = "Passwords do not match."; return; }
  inviteMessage.textContent = "Activating your account…";
  try {
    const user = await acceptInvite(inviteToken, password);
    inviteMessage.textContent = "";
    showAuth(user);
    await loadManifest();
  } catch (error) { inviteMessage.textContent = error.message || "Account activation failed."; }
});
document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault(); message.textContent = "Signing in…";
  try { const user = await login(document.querySelector("#email").value, document.querySelector("#password").value); showAuth(user); message.textContent = ""; await loadManifest(); }
  catch (error) { message.textContent = error.message || "Sign-in failed."; }
});
document.querySelector("#logout").addEventListener("click", async () => { await logout(); showAuth(null); assetsRoot.textContent = ""; });
document.querySelector("#refresh").addEventListener("click", () => loadManifest(editionSelect.value));
editionSelect.addEventListener("change", () => loadManifest(editionSelect.value));
const callback = await handleAuthCallback();
if (callback?.type === "invite") {
  inviteToken = callback.token;
  loginPanel.hidden = true;
  dashboard.hidden = true;
  invitePanel.hidden = false;
} else {
  const user = await getUser(); showAuth(user);
  if (user) loadManifest().catch((error) => { assetsRoot.textContent = error.message; });
}
