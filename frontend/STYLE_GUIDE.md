# SIT LMS / Admin Portal - Master Design System Guide

Single source of truth for:

- Student Portal
- Trainer Portal
- Admin Panel
- Placement Cell
- Support System
- Schedule System
- Reports
- Communication Module

This design system must be followed across the entire application without exceptions.

---

# 1. Product Design Philosophy

The product should feel:

- Professional
- Premium
- Operational
- Structured
- Calm
- Fast to scan
- Modern SaaS
- Enterprise-ready

Target feel:

- Linear
- Stripe Dashboard
- Notion Admin
- Modern SaaS Workspace

Avoid:

- Dribbble-style decorative UI
- Oversized cards
- Excessive whitespace
- Heavy gradients
- Glows
- Random spacing
- Inconsistent radii
- Over-designed layouts

---

# 2. Layout System

## App Layout

Sidebar Width:
240px

Main Content Padding:
24px

Content Gap:
20px

Page Width:

```css
max-width: 1600px;
margin: 0 auto;
```

Page Background:
#F5F7FB

---

# 3. Grid System

Use only these layout patterns:

## Standard Dashboard Grid

```css
display: grid;
gap: 20px;
```

## 2 Column Layout

```css
grid-template-columns: 1fr 1fr;
```

## 3 Column Layout

```css
grid-template-columns: repeat(3, 1fr);
```

## KPI Layout

```css
grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
```

Never use random percentages unless necessary.

---

# 4. Spacing System

ONLY use this spacing scale:


| Token   | Size |
| ------- | ---- |
| XS      | 4px  |
| SM      | 8px  |
| MD      | 12px |
| LG      | 16px |
| XL      | 20px |
| XXL     | 24px |
| SECTION | 32px |


Never use:

- 13px
- 17px
- 19px
- 27px
- random spacing values

---

# 5. Typography System

Font Family:

```css
font-family: "Inter", sans-serif;
```

## Page Heading

```css
font-size: 32px;
font-weight: 700;
line-height: 40px;
letter-spacing: -0.5px;
```

## Section Heading

```css
font-size: 22px;
font-weight: 600;
line-height: 32px;
```

## Card Heading

```css
font-size: 18px;
font-weight: 600;
line-height: 28px;
```

## Body Text

```css
font-size: 14px;
font-weight: 400;
line-height: 22px;
```

## Small Labels

```css
font-size: 12px;
font-weight: 500;
line-height: 18px;
opacity: 0.75;
```

## KPI Numbers

```css
font-size: 32px;
font-weight: 700;
line-height: 1;
letter-spacing: -1px;
```

Never introduce random typography sizes.

---

# 6. Color System

## Primary Colors

Primary Blue:
#2563EB

Dark Blue:
#1D4ED8

Sidebar Gradient:
linear-gradient(180deg, #071B4D 0%, #1E3A8A 100%)

Background:
#F5F7FB

Card Background:
#FFFFFF

Border:
#E5E7EB

Divider:
#EEF2F7

Primary Text:
#0F172A

Secondary Text:
#64748B

Muted Text:
#94A3B8

---

# 7. Status Colors

## Success

Background:
#DCFCE7

Text:
#166534

---

## Warning

Background:
#FEF3C7

Text:
#92400E

---

## Danger

Background:
#FEE2E2

Text:
#991B1B

---

## Info

Background:
#DBEAFE

Text:
#1D4ED8

---

# 8. Border Radius System

STRICT radius rules:


| Component    | Radius |
| ------------ | ------ |
| Cards        | 10px   |
| Buttons      | 10px   |
| Inputs       | 10px   |
| Tables       | 12px   |
| Pills/Badges | 999px  |
| Modals       | 16px   |


Never exceed:
20px radius

Do NOT create random radii.

---

# 9. Card Design System

All cards MUST use:

```css
background: #FFFFFF;
border: 1px solid #E5E7EB;
border-radius: 10px;
padding: 20px;
box-shadow:
  0 1px 2px rgba(15,23,42,0.04),
  0 8px 24px rgba(15,23,42,0.04);
transition: all 0.2s ease;
```

## Card Hover

```css
transform: translateY(-2px);
```

Avoid:

- giant shadows
- floating/glowing cards
- decorative cards

Cards should feel:

- operational
- structured
- enterprise-grade

---

# 10. Button System

## Primary Button

```css
height: 44px;
padding: 0 16px;
border-radius: 10px;
background: #2563EB;
color: #FFFFFF;
font-size: 14px;
font-weight: 600;
```

## Secondary Button

```css
background: #EFF6FF;
border: 1px solid #BFDBFE;
color: #2563EB;
```

## Ghost Button

```css
background: transparent;
border: 1px solid #E5E7EB;
color: #475569;
```

Never use:

- oversized buttons
- gradient buttons
- glowing buttons

---

# 11. Input System

## Input

```css
height: 44px;
border-radius: 10px;
border: 1px solid #E5E7EB;
padding: 0 16px;
background: #FFFFFF;
font-size: 14px;
```

## Textarea

```css
min-height: 140px;
padding: 16px;
border-radius: 12px;
```

## Focus State

```css
border-color: #2563EB;
box-shadow: 0 0 0 4px rgba(37,99,235,0.12);
```

---

# 12. Tabs System

## Tabs Wrapper

```css
background: #F8FAFC;
border: 1px solid #E5E7EB;
border-radius: 12px;
padding: 4px;
display: flex;
gap: 4px;
```

## Tab Button

```css
height: 40px;
padding: 0 14px;
border-radius: 8px;
font-size: 14px;
font-weight: 500;
color: #64748B;
```

## Active Tab

```css
background: #2563EB;
color: #FFFFFF;
```

Avoid:

- excessive glassmorphism
- glows
- huge tabs

---

# 13. KPI Card System

## KPI Card

```css
min-height: 110px;
padding: 20px;
border-radius: 10px;
```

## KPI Layout

Top Section:

- icon left
- info right

Bottom Section:

- trend
- comparison text

## KPI Number

```css
font-size: 32px;
font-weight: 700;
```

## KPI Label

```css
font-size: 14px;
color: #64748B;
```

---

# 14. Sidebar System

## Sidebar

```css
width: 240px;
background: linear-gradient(180deg, #071B4D 0%, #1E3A8A 100%);
padding: 24px 20px;
```

## Nav Item

```css
height: 42px;
padding: 0 14px;
border-radius: 10px;
display: flex;
align-items: center;
gap: 12px;
```

## Active Nav Item

```css
background: rgba(255,255,255,0.12);
border: 1px solid rgba(255,255,255,0.1);
```

Avoid oversized sidebar items.

---

# 15. Hero Section

Used for:

- dashboard headers
- overview banners
- placement summaries

## Hero Card

```css
min-height: 180px;
padding: 24px;
border-radius: 16px;
background: linear-gradient(135deg, #071B4D 0%, #1D4ED8 100%);
```

## Hero Title

```css
font-size: 32px;
font-weight: 700;
line-height: 40px;
```

Avoid giant empty hero areas.

---

# 16. Table System

## Table Wrapper

```css
background: #FFFFFF;
border: 1px solid #E5E7EB;
border-radius: 12px;
overflow: hidden;
```

## Table Row

```css
height: 56px;
```

## Table Header

```css
font-size: 12px;
font-weight: 600;
letter-spacing: 0.04em;
text-transform: uppercase;
color: #64748B;
```

## Hover

```css
background: #F8FAFC;
```

Tables must prioritize:

- scanability
- compactness
- alignment

---

# 17. Badge System

## Badge

```css
height: 28px;
padding: 0 12px;
border-radius: 999px;
font-size: 12px;
font-weight: 600;
display: inline-flex;
align-items: center;
```

Avoid oversized pills.

---

# 18. Icon System

Use ONLY:
Lucide Icons

## Sizes


| Type   | Size |
| ------ | ---- |
| Small  | 16px |
| Normal | 20px |
| Large  | 24px |
| Hero   | 40px |


Never mix icon libraries.

---

# 19. Motion System

## Allowed

```css
transition: all 0.2s ease;
```

Allowed:

- subtle hover elevation
- subtle fade
- translateY(-2px)

NOT allowed:

- bounce
- spin
- large animations
- glow animations

---

# 20. Visual Density Rules

The product should prioritize:

- operational density
- scanability
- structured layouts

Avoid:

- giant empty spaces
- oversized cards
- decorative layouts

Keep related information visually grouped.

---

# 21. Border Rules

Rules:

- maximum one border layer per group
- avoid nested bordered cards
- use spacing instead of separators where possible

Avoid:

- border-inside-border layouts

---

# 22. Empty State Rules

Every empty state should include:

- illustration/icon
- concise explanation
- primary CTA

Avoid blank pages.

---

# 23. Responsive Rules

## Laptop First

Primary target:
1440px

## Tablet

- sidebar collapses
- grids reduce

## Mobile

- cards stack vertically
- tabs scroll horizontally

---

# 24. UX Rules

Every page must answer:

1. What is happening?
2. What needs attention?
3. What action should user take?

Avoid dashboards with no actionability.

---

# 25. Component Consistency Rule

If one module uses:

- 20px padding
- 10px radius
- 14px text

ALL modules must follow same scale.

No module should visually feel like a different product.

---

# 26. Anti-Pattern Rules

DO NOT use:

- oversized radius
- giant floating cards
- excessive gradients
- glow effects
- random shadows
- decorative empty space
- centered enterprise layouts
- random spacing values
- unnecessary animations

---

# 27. Cursor Enforcement Rules

Cursor MUST:

- reuse existing components
- follow spacing scale
- follow radius system
- maintain compact SaaS density
- prioritize structure over decoration

Cursor MUST NOT:

- invent new visual styles
- create Dribbble-style layouts
- introduce new gradients
- overuse glassmorphism
- create oversized cards

---

# 28. Final Validation Checklist

Before shipping any UI:

Check:

- spacing consistency
- typography consistency
- radius consistency
- visual hierarchy
- alignment
- scanability
- compactness
- SaaS feel

