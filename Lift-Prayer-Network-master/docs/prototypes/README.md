# Lift Design Prototypes

This folder contains non-production web prototypes used as visual and UX references for the native Lift app.

## `LiftPrototype.tsx`

A web-only React prototype that explores the full user journey — including the prayer feed, streak/rhythm concept, request creation flow, profile/settings layout, and community screens. It was built with Tailwind CSS and inline SVG icons to iterate quickly on hierarchy, spacing, and interaction patterns.

**How to use it**
- Treat this as a **design reference**, not runnable app code.
- Do not import it into the Expo/RN app — it uses web-only primitives (`div`, `svg`, CSS classes) that will break the native build.
- When translating ideas to React Native, use the shared components in `src/components/LiftLayout.tsx`, `Ionicons`, and `src/theme/colors.ts` instead of the prototype’s inline icon system and palette.

**Key patterns to carry over**
- Calmer card hierarchy: rounded-2xl/3xl cards with soft borders and warm surface colors.
- Compact section headers: small uppercase labels with wide letter spacing.
- Mini stat cards: icon + label + large readable number.
- Prayer streak/rhythm card: gentle visual pulse, day-by-day dots, cumulative stats.
- Feed filtering feel: pill-style chips with clear active states.
- Create flow clarity: large heading prompt, minimal textarea, category pills, toggle rows.
- Profile/settings journey: avatar-centered header, stat grid, grouped action rows.
