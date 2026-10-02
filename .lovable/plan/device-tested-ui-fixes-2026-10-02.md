# Device-tested UI fixes

## Scope
- Restore the exact blue primary, hover, accent, and focus colors through the shared design tokens.
- Standardize keyboard focus to a 2px primary `:focus-visible` ring without tap outlines on tabs, chips, links, cards, and icon controls.
- Correct app-shell bottom spacing using the bottom tab height, safe area, and 16px clearance.
- Reposition list action buttons above the bottom tabs and hide them whenever their list is empty.
- Show the shared logo/credits/notifications top bar only on Home, Resumes, Jobs, Analyses, and Me. Detail and stack screens will use one in-page back/title/menu header.
- Improve result tabs with a hidden scrollbar, right-edge overflow fade, and automatic scrolling to the active tab.
- Make Recalculate solid primary when available; disable it with pale styling and an explanatory caption until suggestions have changed the resume.
- Fix text formatting: singular/plural pages, category casing (including HR), non-wrapping badges, and source domains with external-link icons.
- Add resume name and date subtitles to analysis list cards, recent Home analyses, and analysis detail. Existing IDs will be used to load the linked resume where the response does not include its title.
- Format 30-day credit movement as non-zero signed parts, such as `+500 · last 30 days`.

## Technical details
- Add shared CSS utilities/tokens for safe bottom clearance, focus treatment, and scrollbar hiding.
- Use route detection in the app shell to render top chrome only on the five exact tab-root paths.
- Use refs in the result tab strip to scroll the selected tab into view.
- Determine Recalculate availability by comparing the latest resume version with the report version, matching the documented API behavior.
- Keep all server behavior and Android build files unchanged.

## Verification
- Check the preview at mobile and desktop widths, including a detail screen and horizontally scrolled result tabs.
- Confirm the latest build diagnostics are clean.
