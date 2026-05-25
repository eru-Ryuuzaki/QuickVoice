# QuickVoice Anthropic Style Design

## Goal

Restyle the existing QuickVoice workbench to match the approved "Warm Product Console" direction: warm paper surfaces, restrained borders, light radius, and a clay/terracotta accent. This is a visual-only change; TTS, STT, provider selection, upload, audio playback, transcript editing, and summary behavior stay unchanged.

## Visual Direction

- Use a warm off-white page background with subtle paper-like depth through surface color differences, not decorative gradients.
- Use charcoal text for primary content and warm gray for secondary metadata.
- Replace the current neon green accent with a terracotta accent for active tabs, primary buttons, focus rings, and activity state.
- Keep the existing serif display and mono body pairing, but reduce the dark-console feel by removing deep backgrounds and high-contrast glow.
- Use small-radius panels and controls, fine borders, and compact spacing so the app remains a workbench rather than a landing page.

## Components

- `globals.css`: redefine theme tokens and global background/typography behavior.
- `Workbench`: keep the header and two-panel grid, update panel/header spacing and surface treatment.
- `ModeSwitch`, `SystemStatus`, `TtsForm`, `SttPanel`, `ModelInput`, result panels, and summary UI: reuse the same CSS variables so the style changes remain consistent and scoped.

## Data Flow And Behavior

No data flow changes. Existing React state and API calls remain untouched.

## Error Handling

Error panels should remain visibly distinct, changing from dark red boxes to light warm red boxes with readable dark red text.

## Testing

Run the existing component/app tests that cover the modified UI files. If a browser server is practical, also inspect the rendered page to catch obvious contrast, spacing, and overflow issues.
