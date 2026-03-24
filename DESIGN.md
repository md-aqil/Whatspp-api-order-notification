# Design System Document: The Conversational Architect

## 1. Overview & Creative North Star
This design system is built to transform complex e-commerce workflows into a seamless, editorial-grade experience. Our Creative North Star is **"The Digital Curator."** 

Unlike traditional "SaaS-blue" dashboards that rely on heavy lines and rigid grids, this system uses a high-contrast typography scale and "atmospheric" depth. We move beyond the template look by embracing intentional asymmetry—using varying column widths and overlapping surfaces—to guide the user’s eye through the WhatsApp commerce journey. The goal is a workspace that feels like a premium business tool: authoritative, calm, and hyper-legible.

## 2. Colors
Our palette is rooted in a professional "Cool-to-Vibrant" spectrum. We utilize deep blues for authority and a range of luminous surfaces to create a sense of breathability.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning or layout containment. Structural boundaries must be defined solely through background color shifts. For instance, a side panel in `surface-container-low` should sit directly against a `surface` background without a stroke.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the `surface-container` tiers to create "nested" depth:
- **Base Layer:** `surface` (#f8f9ff)
- **Primary Sectioning:** `surface-container-low` (#eff4ff)
- **Interactive Cards:** `surface-container-lowest` (#ffffff)
- **Emphasis/Floating Menus:** `surface-container-high` (#dce9ff)

### The "Glass & Gradient" Rule
To elevate the system, floating elements (like Toast notifications or Modal overlays) should utilize semi-transparent versions of `surface` with a 20px-40px backdrop-blur. 
- **Signature Textures:** Main CTAs should not be flat. Apply a subtle linear gradient from `primary` (#005cc0) to `primary-container` (#3784f7) at a 135-degree angle to provide "soul" and professional polish.

## 3. Typography
We use a dual-font strategy to balance editorial sophistication with functional clarity.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision and modern "tech-humanist" feel. Use `display-lg` for high-impact entry points to establish a clear visual anchor.
*   **Body & Titles (Inter):** The workhorse for data-heavy commerce tasks. Inter provides exceptional legibility at small sizes (label-sm) and maintains a neutral, professional tone.

**Hierarchy as Identity:** By dramatically scaling up headlines (`headline-lg` at 2rem) against compact body text (`body-md` at 0.875rem), we create an "Editorial" rhythm that makes long forms feel less like work and more like a curated experience.

## 4. Elevation & Depth
In this system, elevation is an atmospheric property, not a structural one.

*   **The Layering Principle:** Achieve depth through "tonal stacking." A card using `surface-container-lowest` (#ffffff) placed on a background of `surface-container-low` (#eff4ff) creates a natural lift.
*   **Ambient Shadows:** If a floating effect is required (e.g., a "Send Catalog" drawer), use a shadow with a blur of 32px and 4% opacity. The shadow color must be a tinted version of `on-surface` (#05345c) to ensure it feels like natural ambient light.
*   **The "Ghost Border" Fallback:** If accessibility requirements demand a container edge, use the `outline-variant` token at 15% opacity. **Never use 100% opaque borders.**
*   **Glassmorphism:** Use `surface-variant` with a backdrop-blur for secondary headers to allow content colors to bleed through, softening the transition between sections.

## 5. Components

### Buttons
- **Primary:** Gradient fill (`primary` to `primary-container`), white text (`on-primary`), and `DEFAULT` (0.5rem) rounding.
- **Secondary:** Surface-based with `outline` text. No fill, no border—rely on the hover state color shift to `surface-container`.

### Input Fields
- Use `surface-container-lowest` for the field background to make it "pop" from the `surface` background. 
- Instead of a full border, use a 2px bottom-accent of `primary` only when the field is focused.

### Cards & Lists (The "Divider-Free" Rule)
- **Forbid the use of divider lines.** Separate list items using vertical white space (use `Spacing 4` or `Spacing 6`) or alternating tonal shifts.
- For WhatsApp message templates, use a `surface-container-highest` background to group the content, mirroring the "bubble" logic of the messaging app but with professional refinement.

### Messaging-Specific Components
- **Template Status Chips:** Use `secondary-container` for backgrounds with `on-secondary-container` text. Keep rounding `full` (9999px) for a "pill" look that contrasts with the `md` rounding of cards.
- **Variable Tags:** Place mapping variables (e.g., `{{1}}`) in a `tertiary-container` bubble to distinguish technical data from conversational text.

## 6. Do's and Don'ts

### Do
- **Do** use `Spacing 12` and `Spacing 16` to create vast "white space" between major functional sections.
- **Do** use `on-surface-variant` for helper text to maintain a soft visual hierarchy.
- **Do** lean into `tertiary` colors for "Utility" labels to keep them distinct from "Marketing" or "Sales" primary actions.

### Don't
- **Don't** use pure black (#000000) for text. Always use `on-surface` (#05345c) to maintain the "Cool Professional" vibe.
- **Don't** use sharp 0px corners. Every element must have at least `sm` (0.25rem) rounding to feel "friendly" and modern.
- **Don't** use "Drop Shadows" for standard cards; rely on the `surface` shifts for 90% of the UI.