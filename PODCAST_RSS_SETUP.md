# Sapiver Forge hosted podcast feed

Public feed:

https://sapiverforge-daily-brief.netlify.app/podcast/feed.xml

Public podcast page:

https://sapiverforge-daily-brief.netlify.app/podcast/

## Before submitting the feed

1. Confirm the approved 3000 x 3000 cover loads from `public/podcast/sapiver-forge-ai-briefing-cover-v1.png`.
2. Run Sapiver Forge weekly publishing workflow successfully so the feed contains at least one complete Irene MP3 episode.
3. Open the feed URL and confirm the episode title, description, artwork and playable enclosure.
4. Validate the feed with a podcast RSS validator.
5. In Spotify for Creators, add or claim a show using the RSS feed URL. Do not submit a second copy unless the existing one-episode show will be removed or replaced.

## Automatic publishing

Daily editions are copied from:

`drafts/YYYY-MM-DD/podcast/sapiver-forge-weekly-podcast-YYYY-MM-DD.mp3`

Weekly and special editions are copied from their `reports/` production folders.

Public copies are stored as:

`public/podcast/episodes/<episode-slug>.mp3`

The publisher updates:

- `public/podcast/feed.xml`
- `public/podcast/episodes.json`
- `public/podcast/index.html`
- `public/podcast/episodes/<episode-slug>.html`

Spotify reads the RSS feed after the feed is connected. The workflow does not use Spotify account credentials and cannot guarantee immediate Spotify ingestion.
