---
name: frontend-design
description: 'Applies the 5 Golden Rules of KA-CHOW frontend design. Use this skill when creating or modifying React components, UI elements, or styling in the frontend folder to ensure strict compliance with the Design Requirements Document (DRD).'
---

# KA-CHOW Frontend Design Guidelines (Neo-Brutalism)

## When to Use
- Scaffolding or creating new React components in the `frontend/` directory.
- Modifying existing UI elements, layouts, or pages.
- Applying styling to any part of the frontend application to achieve a Dark Neo-Brutalist aesthetic.

## Procedure
When designing or modifying frontend components, you must strictly follow the **Neo-Brutalism Golden Rules**:

1. **Use UI Components**:
   - **NEVER** write raw HTML elements for standard UI parts.
   - **DO** import standardized components from `@/components/ui/` (e.g., `@/components/ui/button`).

2. **Aggressive Color Palette (Neo-Brutalism)**:
   - **Backgrounds**: `#111111` or `#1c1c1c` (Solid dark, no blurred gradients).
   - **Accents**: Acid Yellow (`var(--primary)`), Hot Pink (`var(--secondary)`), Neon Cyan (`var(--accent)`), Danger Red (`var(--destructive)`).
   - **Borders**: Sharp solid white or solid accent colors.
   - **NEVER** use hex codes directly. Use semantic tokens.

3. **Neo-Brutalist Shadows & Borders**:
   - Use aggressive, unblurred drop shadows instead of soft shadows.
   - Use the custom CSS properties: `shadow-brutal`, `shadow-brutal-hover`, `shadow-brutal-primary`.
   - Add thick borders (e.g., `border-2` or `border-4`) to distinct interactive elements.
   - `border-radius` should be exactly `0px` (or absolutely minimal roundness). No pill-shaped buttons unless explicitly requested.

4. **Typography**:
   - **Page Title (`<h1>`)**: Space Grotesk (Bold, Uppercase)
   - **Body Text**: Space Grotesk
   - **Badges/Metadata (`<small>` or `<span className="badge">`)**: JetBrains Mono (Uppercase)

5. **Interactivity**:
   - Buttons and cards should physically depress when clicked (`active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`).
   - Hover states should slightly reduce the brutal shadow or shift the element (`hover:-translate-x-[2px] hover:-translate-y-[2px]`).

## Quality Criteria & Review Checklist
Before finalizing UI code or presenting it to the user, ensure:
- [ ] No raw HTML tags are used for standard UI components.
- [ ] No square-bracket arbitrary spacing or color classes (e.g., `w-[...]`, `bg-[#...]`).
- [ ] Only standard semantic color tokens are implemented.
- [ ] Component duplications for styling purposes have been avoided.
