# SIT LMS Design System — Style Guide

> **Version:** 2.0
> **CSS Prefix:** `spx-` (all new components must use this prefix)
> **Reference Page:** Admin Student Profile (`AdminStudentDetailPage.tsx`)
> **Last Updated:** May 2026

---

## 1. TYPOGRAPHY

### Font Stack

```css
font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

- **DM Sans** is the ONLY font for all UI text — headings, body, labels, inputs, buttons.
- Loaded via Google Fonts: weights **300, 400, 500, 600** + italic 400.
- **DM Mono** (400, 500) is available for monospaced data (batch codes, IDs, amounts) — use sparingly.
- Every `<input>`, `<select>`, `<textarea>`, `<button>` must set `font-family: inherit` so DM Sans cascades.

### Font Size Scale (strict — do NOT invent sizes)

| Token         | Size     | Use case                                              |
|---------------|----------|-------------------------------------------------------|
| `xs`          | 10.5px   | Tiny badges, pill labels, category tags               |
| `sm`          | 11.5px   | Timestamps, hints, secondary metadata                 |
| `caption`     | 12px     | Status text, helper text, notes                       |
| `body-sm`     | 12.5px   | Field labels (uppercase), sidebar labels              |
| `body`        | 13px     | Default body text, table cells, field values          |
| `body-md`     | 13.5px   | Input text, modal field text, button text             |
| `body-lg`     | 14px     | Modal inputs, slightly emphasized body                |
| `subtitle`    | 15px     | Section titles, summary values                        |
| `title`       | 16px     | Card headers, modal titles                            |
| `heading`     | 18px     | Hero name, page-level headings                        |

### Font Weights

| Weight | Use case                                           |
|--------|----------------------------------------------------|
| 400    | Body text, descriptions, notes                     |
| 500    | Field values, input text, metadata, labels         |
| 600    | Section titles, button text, strong labels, names  |
| 700    | Hero name, modal titles, summary amounts           |

### Letter Spacing

| Value     | Use case                                          |
|-----------|---------------------------------------------------|
| `-1px`    | Avatar initials only                              |
| `0`       | Default — all body text                           |
| `0.01em`  | Badge/pill text                                   |
| `0.04em`  | Small caps metadata                               |
| `0.05em`  | Uppercase field labels (FULL NAME, EMAIL, etc.)   |
| `0.06em`  | Stat card labels in hero                          |

---

## 2. COLOR PALETTE

### Core Colors

| Token              | Hex       | Usage                                      |
|--------------------|-----------|---------------------------------------------|
| `--page-bg`        | `#F0EEE9` | Page background (warm beige)                |
| `--card-bg`        | `#FFFFFF` | Card/section backgrounds                    |
| `--card-border`    | `#E8E6E1` | Card borders, dividers                      |
| `--section-hdr-bg` | `#F3F4F6` | Grey banded section headers                 |
| `--section-hdr-border` | `#E5E7EB` | Section header bottom border            |
| `--hero-bg`        | `#F9F8F6` | Hero card background (slightly off-white)   |

### Text Colors

| Token              | Hex       | Usage                                      |
|--------------------|-----------|---------------------------------------------|
| `--text-primary`   | `#111827` | Primary text, headings, field values        |
| `--text-body`      | `#1a1a1a` | Page-level body text                        |
| `--text-secondary` | `#374151` | Section titles, labels, modal titles        |
| `--text-muted`     | `#6B7280` | Descriptions, subtitles, inactive text      |
| `--text-light`     | `#9CA3AF` | Timestamps, hints, placeholders, empty states |

### Accent Colors (functional)

| Token              | Hex       | Usage                                       |
|--------------------|-----------|----------------------------------------------|
| `--blue-600`       | `#2563EB` | Primary actions, links, active tabs, focus rings |
| `--blue-700`       | `#1D4ED8` | Hover state for primary buttons              |
| `--blue-50`        | `#EFF6FF` | Blue tint backgrounds (badges, view buttons) |
| `--blue-200`       | `#BFDBFE` | Blue border for light badges                 |
| `--green-600`      | `#16A34A` | Success states, payment clear badge          |
| `--green-500`      | `#22C55E` | Active dot, success pill                     |
| `--green-50`       | `#F0FDF4` | Success tint background                      |
| `--red-600`        | `#DC2626` | Error text, pending amounts, danger actions  |
| `--red-700`        | `#B91C1C` | Danger hover state                           |
| `--red-50`         | `#FEF2F2` | Error/danger tint background                 |
| `--amber-500`      | `#F59E0B` | Star ratings, warning badges                 |
| `--amber-800`      | `#92400E` | Warning text on amber background             |
| `--amber-50`       | `#FEF3C7` | Warning tint background                      |
| `--purple-700`     | `#5B21B6` | Avatar initials text                         |
| `--purple-100`     | `#EDE9FE` | Avatar background                            |

### Semantic Color Rules

- **Stage badges:** Yellow bg (`#FEF3C7`) + dark amber text (`#92400E`)
- **Payment Clear:** Green bg (`#F0FDF4`) + green text (`#16A34A`) + green border (`#BBF7D0`)
- **Active/Inactive:** Green bg (`#F0FDF4`) or default grey (`#F3F4F6`)
- **Error messages:** Red bg (`#FEF2F2`) + red text (`#DC2626`) + red border (`#FECACA`)
- **Focus ring on inputs:** `box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12)`

---

## 3. SPACING SYSTEM

### Base Unit: 4px

All spacing must be a multiple of 4px. Allowed values:

| Token   | Value | Common use                                 |
|---------|-------|--------------------------------------------|
| `2xs`   | 2px   | Tight gaps (star icons, pill padding-y)    |
| `xs`    | 4px   | Inner icon gaps, tight padding             |
| `sm`    | 8px   | Small gaps, button internal spacing        |
| `md`    | 10px  | Compact card padding, list item gaps       |
| `base`  | 12px  | Default gaps, section header padding       |
| `lg`    | 14px  | Timeline item padding, comfortable gaps    |
| `xl`    | 16px  | Card body padding, grid gaps               |
| `2xl`   | 18px  | Section body padding                       |
| `3xl`   | 20px  | Grid column gaps, generous padding         |
| `4xl`   | 24px  | Modal padding, large sections              |
| `5xl`   | 28px  | Page-level horizontal padding              |

### Page Layout

```
Page horizontal padding: 28px
Section body padding:    18px 22px
Section header padding:  12px 22px
Card internal padding:   16px 20px
Modal body padding:      20px 24px
Modal header/footer:     16px-18px 24px
```

### Grid Gaps

```
Field grids (4-5 col):  gap: 16px 20px
Modal form grids:       gap: 14px 16px
Stat cards (hero):      gap: 0 (dividers between)
```

---

## 4. LAYOUT RULES

### Page Structure

```
+---------------------------------------------+
| Back to [Parent] (on beige bg, no white bar) |
+---------------------------------------------+
| Hero Card (white, rounded)                   |
|  +------------------------------------------+|
|  | Avatar | Name + Stars | Email/Phone      ||
|  | Stage badges                             ||
|  +------------------------------------------+|
|  +------------------------------------------+|
|  | 6-column stat bar with dividers          ||
|  +------------------------------------------+|
+----------------------+-----------------------+
| Main Content (flex)  | Sidebar (268px)       |
| - Tab bar            | - Quick Actions       |
| - Section cards      | - Feedback card       |
|                      | (position: sticky)    |
+----------------------+-----------------------+
```

### Two-Column Layout

```css
.content-area {
  display: flex;
  gap: 18px;
  align-items: flex-start;    /* DO NOT stretch */
}
.main-column {
  flex: 1;
  min-width: 0;               /* prevent overflow */
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.sidebar {
  width: 268px;
  flex-shrink: 0;
  position: sticky;
  top: 14px;
  max-height: calc(100vh - 28px);
  overflow-y: auto;
}
```

### Responsive Breakpoints

| Breakpoint   | Behavior                                     |
|-------------|----------------------------------------------|
| > 1280px    | Full 2-column layout, 5-col field grids      |
| 1024-1280px | 2-column layout, 3-col field grids           |
| < 1024px    | Single column stack, sidebar below content   |

---

## 5. COMPONENTS

### 5.1 Section Cards

Every detail card follows this exact structure:

```html
<div class="section">
  <div class="section-header">
    <span class="section-title"><Icon size={16} /> Title</span>
    <!-- optional: action button on the right -->
  </div>
  <div class="section-body">
    <!-- fields grid -->
  </div>
</div>
```

**Specs:**

```css
background: #fff;
border: 1px solid #E8E6E1;
border-radius: 14px;
overflow: hidden;             /* clips header corners */
padding: 0;                   /* body has its own padding */
```

**Section Header (grey band — EVERY card has this):**

```css
background: #F3F4F6;
border-bottom: 1px solid #E5E7EB;
padding: 12px 22px;
display: flex;
align-items: center;
justify-content: space-between;
```

**Section Title:**

```css
font-size: 15px;
font-weight: 600;
color: #374151;
display: flex;
align-items: center;
gap: 8px;
```

**Section Body:**

```css
padding: 18px 22px;
```

### 5.2 Field Grids

Fields are displayed in CSS grids inside section bodies:

```css
display: grid;
grid-template-columns: repeat(5, 1fr);  /* or repeat(4, 1fr) */
gap: 16px 20px;
```

**Each Field:**

```
+--------------+
| LABEL        |  <-- uppercase, 11.5px, weight 600, color #6B7280, letter-spacing 0.05em
| Value        |  <-- 13px, weight 500, color #111827
+--------------+
```

**Empty values:** Show em-dash "-" in color `#9CA3AF`.

### 5.3 Hero Card

```css
background: #F9F8F6;
border: 1px solid #E8E6E1;
border-radius: 14px;
padding: 24px 28px;
```

**Avatar:**

```css
width: 72px;
height: 72px;
border-radius: 50%;
background: #EDE9FE;     /* purple tint */
color: #5B21B6;          /* purple text */
font-size: 24px;
font-weight: 600;
```

If image uploaded: `object-fit: cover; background: #E5E7EB`
On hover: dark overlay (rgba(0,0,0,0.5)) with Upload icon + "Upload" text

**Name:** `font-size: 18px; font-weight: 700; color: #111827`
**Meta (email/phone):** `font-size: 13px; color: #6B7280; gap: 14px`

**Stat Bar (6 columns with dividers):**

```css
display: grid;
grid-template-columns: repeat(6, 1fr);
border-top: 1px solid #E8E6E1;
margin-top: 16px;
```

Each stat cell:
- Label: `10.5px, weight 600, uppercase, letter-spacing 0.06em, color #6B7280`
- Value: `14px, weight 600, color #111827`
- Cells separated by `border-left: 1px solid #E8E6E1` (except first)

### 5.4 Tabs

```css
display: flex;
gap: 0;
border-bottom: 2px solid #E8E6E1;
```

**Tab item:**

```css
padding: 10px 16px;
font-size: 13.5px;
font-weight: 500;
color: #6B7280;
border-bottom: 2px solid transparent;
cursor: pointer;
```

**Active tab:**

```css
color: #2563EB;
font-weight: 600;
border-bottom-color: #2563EB;
```

### 5.5 Buttons

#### Primary Action (filled)

```css
background: #2563EB;
color: #fff;
font-size: 13.5px;
font-weight: 600;
border: none;
border-radius: 9px;
padding: 9px 16px;
```

Hover: `background: #1D4ED8`

#### Secondary Action (sidebar action list)

```css
background: transparent;
color: #374151;
font-size: 13.5px;
font-weight: 500;
border: none;
padding: 9px 0;
display: flex;
align-items: center;
gap: 9px;
border-bottom: 1px solid #F3F2EE;
```

Hover: `color: #2563EB`

#### Danger variant

```css
color: #DC2626;
```

#### Disabled state

```css
opacity: 0.4;
cursor: not-allowed;
pointer-events: none;
```

### 5.6 Badges / Pills

**Stage badge (yellow):**

```css
background: #FEF3C7;
color: #92400E;
border: 1px solid #FDE68A;
border-radius: 20px;
padding: 3px 12px;
font-size: 12px;
font-weight: 600;
```

**Success pill:**

```css
background: #F0FDF4;
color: #16A34A;
border: 1px solid #BBF7D0;
border-radius: 20px;
padding: 3px 10px;
font-size: 11.5px;
font-weight: 600;
```

**Timeline category badge:**

```css
font-size: 10.5px;
font-weight: 600;
padding: 2px 8px;
border-radius: 20px;
/* color and bg are dynamic per category */
```

### 5.7 Modals

```css
/* Overlay */
background: rgba(0, 0, 0, 0.45);
z-index: 9999;
animation: fadeIn 0.15s ease;

/* Modal box */
background: #fff;
border-radius: 16px;
max-width: 520px;            /* or 420px for small modals */
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.05);
animation: slideUp 0.2s ease;

/* Header */
padding: 18px 24px;
border-bottom: 1px solid #E8E6E1;
background: #F9FAFB;

/* Body */
padding: 20px 24px;

/* Footer */
padding: 16px 24px;
border-top: 1px solid #E8E6E1;
background: #F9FAFB;
justify-content: flex-end;
gap: 10px;
```

**Modal title:** `16px, weight 700, color #111827, icon + 8px gap`
**Modal label:** `13px, weight 500, color #6B7280` (NOT uppercase, NOT bold)
**Modal input:** `13.5px, weight 500, border: 1px solid #D1D5DB, border-radius: 9px, padding: 8px 12px`
**Modal input focus:** `border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12)`

**Error box inside modal:**

```css
background: #FEF2F2;
color: #DC2626;
border: 1px solid #FECACA;
border-radius: 8px;
padding: 10px 14px;
font-size: 13px;
font-weight: 500;
```

### 5.8 Tables (inside cards)

```css
width: 100%;
border-collapse: collapse;
font-size: 13px;
```

**Header:** `background: #F9FAFB; font-weight: 600; color: #374151; text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.05em`
**Cells:** `padding: 10px 14px; border-bottom: 1px solid #F3F4F6`
**Row hover:** `background: #F9FAFB`

### 5.9 Timeline

```css
/* Item */
display: flex;
gap: 14px;
padding: 14px 0;
border-bottom: 1px solid #F3F2EE;

/* Dot */
width: 10px;
height: 10px;
border-radius: 50%;
box-shadow: 0 0 0 3px rgba(color, 0.12);
/* color varies by category */

/* Title */
font-size: 13px;
font-weight: 600;
color: #111827;

/* Date */
font-size: 11.5px;
color: #9CA3AF;

/* Subtitle */
font-size: 12.5px;
color: #6B7280;
```

**View button (inline):**

```css
font-size: 11.5px;
font-weight: 600;
color: #2563EB;
background: #EFF6FF;
border: 1px solid #BFDBFE;
border-radius: 6px;
padding: 3px 10px;
```

### 5.10 Sidebar Cards

```css
background: #fff;
border: 1px solid #E8E6E1;
border-radius: 14px;
padding: 16px;
```

**Sidebar title:** `font-size: 13px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.04em`

### 5.11 Progress Bars

```css
height: 5px;
background: #E5E7EB;       /* track */
border-radius: 2px;
overflow: hidden;
```

Fill color:
- Attendance: `#2563EB` (blue)
- Progress: `#F59E0B` (amber)

### 5.12 Star Ratings

**Display (read-only):**

```
Filled: color #F59E0B (amber)
Empty:  color #D1D5DB (grey)
font-size: 14px;
```

**Interactive (in modal):**

```
font-size: 28px;
color: #D1D5DB (default) --> #F59E0B (active/hover)
hover: transform scale(1.15)
```

Rating system is **3 stars**: 1 = Bad (red label), 2 = Good (amber label), 3 = Excellent (green label).

---

## 6. ICONS

### Library: Lucide React

All icons come from `lucide-react`. Never use other icon libraries.

### Size Rules (strict)

| Size   | Use case                                          |
|--------|---------------------------------------------------|
| 11px   | Inside tiny pills/badges                          |
| 13px   | Timeline view buttons, small inline icons         |
| 14px   | Sidebar card titles, star ratings                 |
| 15px   | Action buttons in sidebar, field icons            |
| 16px   | Section card header titles                        |
| 18px   | Modal header titles, avatar upload overlay        |

### Color Rules

- Icons in section headers: `color: #6B7280`
- Icons in action buttons: inherit parent color
- Icons in hero metadata: `color: #6B7280`

---

## 7. INTERACTION PATTERNS

### Hover States

- Buttons: darken background by one shade
- Action list items: `color: #2563EB`
- Table rows: `background: #F9FAFB`
- Cards/links: subtle shadow increase or border color change
- Avatar: overlay appears (dark bg + upload icon)

### Focus States

- All inputs: `border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12)`
- Buttons: same focus ring
- Never remove outline without providing a visible focus indicator

### Transitions

```css
transition: all 0.15s ease;  /* default for all interactive elements */
```

### Disabled States

```css
opacity: 0.4 to 0.55;
cursor: not-allowed;
pointer-events: none;        /* for buttons */
```

### Animations

| Animation    | Duration | Easing | Use case              |
|-------------|----------|--------|-----------------------|
| `fadeIn`    | 0.15s    | ease   | Modal overlay         |
| `slideUp`   | 0.2s     | ease   | Modal box             |
| `spin`      | 0.6s     | linear | Loading spinners      |

---

## 8. MODAL UX RULES

1. **Overlay click** closes the modal (unless submitting).
2. **Close button** (X icon, top-right) always present.
3. **Footer buttons:** Cancel (left, secondary) + Primary action (right, blue).
4. **Error messages** appear at the top of the modal body.
5. **Loading state:** Primary button text changes ("Saving..." / "Processing..."), button disabled.
6. **Form labels:** Sentence case, 13px, weight 500, color `#6B7280`. NOT uppercase.
7. **Required fields:** Red asterisk `*` after label.
8. **Validation:** Client-side first, then server-side errors shown in the error box.
9. Max width: `520px` standard, `420px` for simple forms.

---

## 9. EMPTY STATES

```css
color: #9CA3AF;
font-size: 13px;
text-align: center;
padding: 40px 0;
```

Use a descriptive sentence: "No activity recorded yet - payments, interviews, and classes will appear here."

---

## 10. DATA FORMATTING RULES

| Data type     | Format                                    |
|---------------|-------------------------------------------|
| Dates         | `4 Mar 2026` (day month year, no leading zero) |
| Currency      | Rs.60,000 (Indian locale, no decimals for round) |
| Percentages   | `58%` (rounded, no decimals)              |
| Phone         | As stored (with country code prefix)      |
| Empty values  | Em-dash in `#9CA3AF` color                |
| Names         | Title case as entered                     |
| Stages        | Humanized: `taking_interviews` to `Taking Interviews` |

---

## 11. TOPBAR / NAVIGATION

- **No white strip** above the page. "Back to [Parent]" sits directly on the beige page background.
- Back button: `font-size: 13px; font-weight: 500; color: #374151; gap: 6px`
- Arrow icon: `ArrowLeft size={15}`
- Top-right actions (Edit, More): absolutely positioned, not in a separate bar.

---

## 12. CSS SCOPING

- All new design classes use the `spx-` prefix.
- Use `:has()` to scope layout overrides: `.student-content:has(.spx-page)` - never apply broad resets.
- Old pages retain their existing CSS (`asp-` prefix for old modal code).
- Never use `!important` unless fixing a third-party override.

---

## 13. PERFORMANCE RULES

- Fetch all data in a single `Promise.all` on page load.
- Use `useMemo` for computed/derived data (timeline items, filtered lists).
- Inline editing uses state toggle, not separate routes.
- Images: max 500x500px, 2MB, stored in Supabase Storage with public URLs.
- Modals load their data on open (e.g., batch list), not on page load.

---

## 14. QUICK REFERENCE - DO's and DON'Ts

### DO

- Use DM Sans for everything
- Use `spx-` prefix for all class names
- Use grey banded headers on EVERY section card
- Use 14px border-radius for cards, 9px for inputs/buttons, 20px for pills
- Show em-dash for empty values
- Use blue (`#2563EB`) as the primary accent everywhere
- Keep modals clean: header + body + footer, max 520px wide
- Validate on client before server
- Use Lucide React icons only

### DON'T

- Don't use Inter, Poppins, or any other font on redesigned pages
- Don't use `text-transform: uppercase` on modal form labels
- Don't create separate edit pages - use inline editing or modals
- Don't use green for primary actions - green is only for success states
- Don't use more than 3 stars for ratings
- Don't add white topbar strips above pages
- Don't use `height: 100vh` on content containers (breaks scroll)
- Don't use `overflow: hidden` on page-level containers
- Don't hardcode values - use the spacing/size tokens above
