(() => {
  const manifestUrl = "https://raw.githubusercontent.com/sapiverpress-studio/SapiverPress_comic_public/main/social/clearforge/latest.json";
  const rawBase = "https://raw.githubusercontent.com/sapiverpress-studio/SapiverPress_comic_public/main/";

  function safeRepositoryPath(value) {
    const path = String(value || "").replaceAll("\\", "/").replace(/^\/+/, "");
    if (!path || path.includes("..") || !path.startsWith("social/clearforge/")) return "";
    return path.split("/").map(encodeURIComponent).join("/");
  }

  async function load() {
    const sections = [...document.querySelectorAll("[data-sapiver-forge-latest-short]")];
    if (!sections.length) return;

    const manifestResponse = await fetch(manifestUrl, { cache: "no-store" });
    if (!manifestResponse.ok) throw new Error("Latest Sapiver Forge social manifest is unavailable.");
    const manifest = await manifestResponse.json();
    const videoPath = safeRepositoryPath(manifest?.tiktok?.video || manifest?.outputs?.tiktok_video);
    const captionPath = safeRepositoryPath(manifest?.tiktok?.caption || manifest?.outputs?.tiktok_caption);
    if (!videoPath || !captionPath) throw new Error("Latest TikTok files are not listed.");

    const captionResponse = await fetch(rawBase + captionPath, { cache: "no-store" });
    if (!captionResponse.ok) throw new Error("Latest TikTok caption is unavailable.");
    const caption = (await captionResponse.text()).trim();
    const videoUrl = rawBase + videoPath;

    for (const section of sections) {
      const host = section.querySelector("[data-short-content]");
      const video = document.createElement("video");
      video.controls = true;
      video.preload = "metadata";
      video.playsInline = true;
      video.src = videoUrl;
      video.style.cssText = "display:block;width:min(100%,360px);max-height:70vh;background:#000;border-radius:14px";

      const actions = document.createElement("p");
      const download = document.createElement("a");
      download.href = videoUrl;
      download.textContent = "Download TikTok MP4";
      download.download = "";
      download.style.cssText = "display:inline-block;padding:10px 14px;border-radius:999px;background:#66a7ff;color:#07111f;font-weight:750;text-decoration:none";
      actions.append(download);

      const label = document.createElement("label");
      label.textContent = "Copy-and-paste TikTok caption";
      label.style.cssText = "display:block;font-weight:700;margin-top:20px";
      const textarea = document.createElement("textarea");
      textarea.readOnly = true;
      textarea.value = caption;
      textarea.style.cssText = "box-sizing:border-box;width:100%;min-height:220px;margin-top:8px;padding:14px;border:1px solid #345274;border-radius:10px;background:#07111f;color:#eef4ff;font:15px/1.5 system-ui";
      label.append(textarea);

      const copyRow = document.createElement("p");
      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "Copy caption";
      copy.style.cssText = "padding:11px 16px;border:0;border-radius:999px;background:#66a7ff;color:#07111f;font-weight:750;cursor:pointer";
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(caption);
          copy.textContent = "Caption copied";
        } catch {
          textarea.focus();
          textarea.select();
          copy.textContent = "Caption selected";
        }
      });
      copyRow.append(copy);

      host.replaceChildren(video, actions, label, copyRow);
      section.hidden = false;
    }
  }

  load().catch((error) => console.warn("Sapiver Forge latest short:", error.message));
})();
