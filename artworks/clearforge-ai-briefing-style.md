# Clearforge AI Briefing Artwork Direction

This file defines the approved Clearforge visual direction for generated imagery used in auto runs, podcast assets, social videos and report promotion.

## Approved visual direction

Clearforge imagery should clearly read as an AI news, AI learning and AI briefing project, but it must avoid generic AI-stock imagery.

The middle-ground style is:

- dark navy or near-black blue studio atmosphere
- professional podcast/news briefing feel
- microphone, audio-waveform or briefing-desk cues where appropriate
- practical source notes, research cards, checklists and human-review materials
- subtle AI signals: circuit traces, model cards, routing lines, waveform panels, data-light accents
- premium editorial technology-magazine lighting
- calm, controlled, human-led, practical and educational

## Colour palette

Use variations of:

- deep navy
- near-black blue
- graphite
- clean white
- cool electric blue
- soft mint
- occasional muted brass or steel

Avoid warm stationery-only imagery that loses the AI/news/podcast signal.

## Must feel like

- Clearforge
- AI briefing podcast
- practical AI learning
- human-led review of AI developments
- careful technology journalism
- premium but not flashy

## Must not feel like

- generic AI image generation
- robot/brain/hologram stock art
- cyberpunk
- SaaS dashboard advert
- unrelated stationery brand
- Sapiver Press or any Sapiver product line

## Prompt rules for auto runs

Future prompts should include:

- a strong AI briefing or podcast setting
- one physical human-review layer: source notes, checklist, cards, notebook, evidence board
- one restrained AI signal layer: waveform, circuit trace, model card, routing line, data-light accent
- clean negative space for renderer text overlay
- no readable typography inside generated imagery

## Banned elements

Do not include:

- Sapiver
- Sapiver Press
- unrelated logos
- robots
- android faces
- glowing brains
- hologram faces
- random floating code
- excessive neon
- cyberpunk cityscapes
- fake readable UI text
- fake logos
- stock-photo handshakes
- medical, legal or financial symbolism

## Current implementation

The active auto-run prompt system is in:

```text
src/generate-ai-media.mjs
```

The current visual system name is:

```text
Clearforge AI briefing podcast studio system
```
