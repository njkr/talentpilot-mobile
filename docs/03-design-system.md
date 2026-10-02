# TalentPilot Design System (from `talentpilot-fe`)

Sources: `app/globals.css` (Tailwind v4 `@theme` — the single source of truth), `app/layout.tsx` (fonts), `components/ui/*`, `components/layout/*`. There is **no tailwind.config file** (Tailwind v4) and **no dark mode** anywhere in the web app.

## 1. Colour palette (exact, from `globals.css`)

| Token (web) | Hex | HSL (computed) | Usage |
|---|---|---|---|
| primary | `#2563eb` | 221 83% 53% | CTAs, links, active nav, focus ring, progress |
| primary-hover | `#1d4ed8` | 224 76% 48% | primary button hover |
| success | `#16a34a` | 142 76% 36% | success, "strong" match, score ≥ 80 |
| warning | `#f59e0b` | 38 92% 50% | warnings, "fair" match, score < 60 |
| danger | `#dc2626` | 0 72% 51% | errors, destructive, "low" match, required-keyword badge |
| bg | `#fafafa` | 0 0% 98% | page background, muted surfaces, input-less panels |
| card | `#ffffff` | 0 0% 100% | cards, modals, inputs |
| border | `#e5e7eb` | 220 13% 91% | all borders, progress track, skeleton (50% opacity) |
| ink | `#111827` | 221 39% 11% | primary text |
| ink-secondary | `#6b7280` | 220 9% 46% | body copy, secondary text |
| ink-muted | `#9ca3af` | 218 11% 65% | captions, placeholders, icons |

Tints are always `colour/10` background + saturated text (e.g. `bg-success/10 text-success`) — "calm, non-neon status treatment". Selected/hover tints use `primary/[0.02–0.04]`, `danger/[0.04]`, `success/[0.04]`.

## 2. Typography
- **Body font**: Inter (`--font-inter`, Google Fonts, `display: swap`), fallback `system-ui, sans-serif`. Antialiased.
- **Display font** (brand wordmark only): Plus Jakarta Sans, weights 500/600/700/800.
- Scale (`components/ui/typography.tsx`): **H1** `text-2xl` (24px) bold, tracking-tight, ink · **H2** `text-xl` (20px) semibold · **H3** `text-base` (16px) semibold · **Body** `text-sm` (14px) ink-secondary, `leading-relaxed` (1.625) · **Caption** `text-xs` (12px) ink-muted · Labels `text-sm font-medium` ink · Big score numeral `text-3xl font-bold`.
- Weights used: 400, 500 (medium), 600 (semibold), 700 (bold).

## 3. Spacing, radius, shadow, breakpoints
- **Spacing**: Tailwind default 4px scale. Cards `p-6`; page vertical rhythm `space-y-6`; grids `gap-4`; page padding `px-4 sm:px-6 lg:px-8`; content max width `max-w-6xl` (forms `max-w-2xl`/`max-w-lg`/`max-w-sm` for auth).
- **Radius** (only these sanctioned): md `0.375rem` (badges, skeleton, progress), lg `0.5rem` (buttons, inputs, chips, toasts), xl `0.75rem` (cards, modals).
- **Shadow** (only sm/md): sm `0 1px 2px 0 rgb(0 0 0/0.05)` (cards); md `0 1px 3px 0 rgb(0 0 0/0.1), 0 1px 2px -1px rgb(0 0 0/0.1)` (modals, popovers, toasts, select menus).
- **Breakpoints**: Tailwind defaults; the web only really uses `sm` 640 (2-col grids) and `lg` 1024 (sidebar appears, 4-col dashboard). Below `lg` the web shows a hamburger drawer.
- **Motion**: 150ms colour transitions on buttons; framer-motion fade/slide-up on dashboard cards; score ring animates 0.8s ease-out; progress bar `duration-300`; skeleton `animate-pulse`.

## 4. Icons
**Heroicons** (`@heroicons/react/24/outline`) everywhere, 16px (`h-4 w-4`) in buttons, 20px (`h-5 w-5`) in nav/menus, 24px topbar, 40px empty states, 48px success check. In Lovable use `lucide-react` equivalents (Home, FileText, Briefcase, LayoutGrid, CreditCard, Gift, Settings, Zap, Bell, ShieldCheck, ChevronDown, Check, X, Upload, ArrowLeft, MoreHorizontal, CheckCircle).

## 5. Component patterns
- **Button** (`ui/button.tsx`): variants `primary` (bg primary, white text, hover primary-hover) · `secondary` (white, border, hover bg) · `ghost` (ink-secondary, hover bg) · `danger` (bg danger, white, hover opacity-90). Sizes: sm h-8 px-3, md h-9 px-4 (default), lg h-10 px-5; all `rounded-lg text-sm font-medium`. States: `loading` (leading spinner replaces icon, `aria-busy`, disabled), disabled `opacity-50`, focus 2px primary ring offset 2. **Mobile: bump to ≥44px height** (see 05).
- **Input** (`ui/input.tsx`): label above (`text-sm font-medium`), `h-9`, `rounded-lg`, border-border, card bg, placeholder ink-muted; error → border-danger + `text-xs text-danger` message; helper `text-xs text-ink-muted`. Textarea/select/checkbox/switch are same family; switch track `bg-primary` when on, `bg-border` off, white thumb.
- **Card**: `bg-card border border-border rounded-xl p-6 shadow-sm`. Selected card: `border-primary bg-primary/[0.02]`. Info banners: `rounded-lg bg-primary/[0.04] px-4 py-3 text-sm`, in-flight banners `bg-primary/5 border-primary/20`, caution `bg-warning/5 border-warning/20`.
- **Badges**: `rounded-md px-2 py-0.5 text-xs font-medium`. Tones: neutral (bg + border), success, warning, danger, primary. Domain badges: *StatusBadge* (created=Draft grey, queued=warning, processing="Running" primary, completed="Complete" success, partial warning, failed danger); *ImpactBadge* (high success / medium primary / low muted); *ImportanceBadge* (required danger / preferred primary / nice_to_have muted); *MatchBandBadge* (low danger / fair warning / strong success); interview difficulty (easy success / medium warning / hard danger); answer score ≥75 success, ≥50 primary, else warning.
- **Tabs**: Radix tabs, horizontally scrollable list with bottom border (`border-b border-border`), content `pt-4`.
- **Chip group** (single-select radio): `rounded-lg px-3 py-1.5 text-xs font-medium`; selected `bg-primary text-white`, else `bg-bg text-ink-secondary`.
- **Modal**: Radix Dialog, centered, `max-w-md rounded-xl bg-card p-6 shadow-md`, overlay `bg-ink/40` + 1px blur, title `text-base font-semibold`, X close. Footer actions right-aligned: secondary Cancel + primary/danger confirm. (→ bottom sheet on mobile.)
- **Toast**: bottom-anchored, 5s, `rounded-lg border p-3 shadow-md text-sm`; tones default (card), error (`border-danger/30 bg-danger/5 text-danger`), warning, success. Programmatic `toast(message, tone)`.
- **Empty state** (`ui/empty-state.tsx`): centered, optional 40px muted icon, title `text-sm font-medium`, description `text-sm ink-secondary max-w-sm`, optional small primary CTA. Every empty list uses guidance copy + action.
- **Loaders**: `Skeleton` (pulse, `bg-border/50 rounded-md`, sized to the card it replaces: h-20/h-24/h-32/h-64 `rounded-xl`), `Spinner` (SVG, `animate-spin`, inherits colour), full-page spinner for auth bootstrap, `Progress` (h-2 rounded-md, track border, fill primary).
- **Score ring** (report): 112px, SVG r=44 stroke 8, colour: ≥80 success, ≥60 primary, else warning; numeral inside `text-3xl font-bold`.
- **Match gauge**: semicircle, zones red/amber/green split at 35%/70% (same cutoffs: low <0.35, fair <0.7, strong ≥0.7), needle by ratio.
- **File dropzone**: dashed-border zone, upload icon, label + helper ("PDF or DOCX, up to 10MB"), error line `text-sm text-danger`; drag highlight `border-primary bg-primary/3`.
- **Layout shell**: topbar `h-14` sticky, `bg-card/80 backdrop-blur-sm`, border-b; sidebar `w-60` (collapsible `w-16`) on lg+; mobile drawer `w-64` from left. Topbar right side: credits pill (`bg-bg` rounded-lg, bolt icon in primary, links to /billing), notification bell with popover, avatar menu.
- **Logo**: blue (`primary`) rounded square with a white upward triangle + dot; wordmark "Talent" ink + "Pilot" primary in Plus Jakarta Sans bold.
- Focus ring (global): `:focus-visible { outline: 2px solid primary; outline-offset: 2px }`.

## 6. shadcn/ui-compatible CSS variables (paste into `src/index.css`)

shadcn expects bare HSL triplets (`hsl(var(--x))`). Values below are exact conversions of the web hexes; rows marked *derived* have no web equivalent and are my mapping choice (flagged in open questions).

```css
@layer base {
  :root {
    --background: 0 0% 98%;            /* bg #fafafa */
    --foreground: 221 39% 11%;         /* ink #111827 */

    --card: 0 0% 100%;                 /* card #ffffff */
    --card-foreground: 221 39% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 221 39% 11%;

    --primary: 221 83% 53%;            /* #2563eb */
    --primary-foreground: 0 0% 100%;
    --primary-hover: 224 76% 48%;      /* #1d4ed8 (custom, use for hover) */

    --secondary: 0 0% 100%;            /* web "secondary" button = white + border */
    --secondary-foreground: 221 39% 11%;

    --muted: 0 0% 98%;                 /* derived: web uses bg #fafafa for muted surfaces */
    --muted-foreground: 220 9% 46%;    /* ink-secondary #6b7280 */
    --subtle-foreground: 218 11% 65%;  /* ink-muted #9ca3af (custom: captions/placeholders) */

    --accent: 221 83% 96%;             /* derived: primary at 10% over white (active nav tint) */
    --accent-foreground: 221 83% 53%;

    --destructive: 0 72% 51%;          /* danger #dc2626 */
    --destructive-foreground: 0 0% 100%;
    --success: 142 76% 36%;            /* #16a34a (custom) */
    --success-foreground: 0 0% 100%;
    --warning: 38 92% 50%;             /* #f59e0b (custom) */
    --warning-foreground: 221 39% 11%;

    --border: 220 13% 91%;             /* #e5e7eb */
    --input: 220 13% 91%;
    --ring: 221 83% 53%;               /* focus ring = primary */

    --radius: 0.5rem;                  /* lg; md=0.375rem, xl=0.75rem */

    --font-sans: "Inter", system-ui, sans-serif;
    --font-display: "Plus Jakarta Sans", "Inter", system-ui, sans-serif;

    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  }
}
```
Tailwind (v3 in Lovable) `theme.extend.colors` should add `success`, `warning`, `subtle` as `hsl(var(--success))` etc. and `borderRadius: { md: "0.375rem", lg: "0.5rem", xl: "0.75rem" }`. **Light only** — do not generate a dark theme unless you decide to (open question).


## 7. Open questions (design)
- **D1** No dark mode exists on web. Ship light-only for v1? (Recommended.)
- **D2** Brand assets: logo is drawn in CSS (`components/layout/logo.tsx`); `talentpilot-fe/public/` not inspected for icon/splash PNGs. Android launcher icon + splash need real files.
- **D3** `secondary`, `muted`, `accent` shadcn tokens are derived mappings (see §6).
- **D4** Web inputs are `h-9` (36px) / buttons `h-8–10`: below the 44px Android touch minimum; mobile must scale them up.
