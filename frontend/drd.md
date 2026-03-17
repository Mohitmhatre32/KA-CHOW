# 🎨 KA-CHOW Design Requirements Document (DRD)

**Version:** 1.0.0  
**Status:** STRICTLY ENFORCED  

This document outlines the non-negotiable frontend engineering standards for the KA-CHOW application. To maintain a consistent, scalable, and professional "GitHub-style Cyber-IDE" interface, **all developers must strictly adhere to the following 5 Golden Rules.** 

Pull Requests violating these rules will be automatically rejected.

---

##  THE 5 GOLDEN RULES

### 1. Use Components from `/ui`
**NEVER** write raw HTML elements for standard UI parts (e.g., `<button>`, `<input>`, `<table>`, `<dialog>`).
*   **DO:** Import the standardized component from your UI library folder (`@/components/ui/button`).
*   **WHY:** Centralized components ensure that focus states, accessibility (a11y), and base styling are perfectly uniform across the entire application.

### 2. No Inline Colors
**NEVER** use hex codes, RGB values, or arbitrary Tailwind color classes in your markup.
*   ** PROHIBITED:** `style={{ color: '#030303' }}`, `className="text-[#58a6ff]"`, `className="bg-red-500"`
*   ** MANDATORY:** `className="text-foreground"`, `className="text-primary"`, `className="bg-destructive"`
*   **WHY:** Our `global.css` controls the theme. Hardcoding colors breaks dark mode, ignores our semantic color system, and creates visual debt.

### 3. No Custom Spacing
**NEVER** use arbitrary pixel values for padding, margins, or gaps. You must stick to the strict 4-point/8-point Tailwind spacing grid.
*   ** PROHIBITED:** `p-[15px]`, `mt-[23px]`, `w-[311px]`
*   ** MANDATORY:** `p-4` (16px), `mt-6` (24px), `w-full max-w-sm`
*   **WHY:** Mathematical consistency in spacing is the difference between an amateur app and an Enterprise-grade tool.

### 4. Use Design Tokens
Always use the semantic design tokens defined in `global.css`. 
*   **Backgrounds:** Use `bg-background` (for the #030303 base) or `bg-card` (for panels).
*   **Typography:** Do not apply manual fonts. 
    *   `<h1>` and `<h2>` will automatically use **Inter (Italic)**.
    *   Standard text will automatically use **Montserrat**.
    *   For metadata, use the `<small>` tag.
    *   For badges/code, use `className="text-micro"` or `className="badge"` to trigger **JetBrains Mono**.

### 5. Add Variants Instead of New Components
**NEVER** duplicate a component just to change its style. 
*   **PROHIBITED:** Creating `SubmitButton.tsx`, `CancelButton.tsx`, or `DangerCard.tsx`.
*   ** MANDATORY:** Use/extend component variants (e.g., `class-variance-authority`). If you need a red button, pass a variant prop: `<Button variant="destructive">Delete</Button>`.
*   **WHY:** Component duplication leads to an unmaintainable codebase. Variants keep the component logic singular and robust.

---

##  QUICK TOKEN REFERENCE

When styling elements, you must restrict yourself to these global CSS variables/Tailwind classes:

### Colors
| Intent | Tailwind Class | CSS Variable | Use Case |
| :--- | :--- | :--- | :--- |
| **App Canvas** | `bg-background` | `--background` | The absolute background (#030303) |
| **Panels/Cards** | `bg-card` / `bg-muted` | `--card` / `--muted` | Sidebars, modals, task cards |
| **Text Default** | `text-foreground` | `--foreground` | Standard readable text |
| **Text Muted** | `text-muted-foreground`| `--muted-foreground` | Timestamps, file paths, sub-labels |
| **Brand/Action** | `text-primary` | `--primary` | Active tabs, primary buttons, links |
| **Success** | `text-success` | `--success` | Passed Quality Gates, Resolved tasks |
| **Warning** | `text-warning` | `--warning` | Uncommitted files (Orange dot), Tech Debt |
| **Danger** | `text-destructive` | `--destructive`| Failed Gates, Errors, Delete actions |

### Typography Elements
| Element | Font | Style | Trigger |
| :--- | :--- | :--- | :--- |
| **Page Title** | Inter | Italic, 20px, SemiBold | `<h1>Title</h1>` |
| **Section Title**| Inter | Italic, 16px, Medium | `<h2>Section</h2>` |
| **Body Text** | Montserrat | Normal, 14px, Regular | Default (no class needed) |
| **Metadata** | Montserrat | Normal, 12px, Muted | `<small>Data</small>` |
| **Badges/Code** | JetBrains Mono| Normal, 10px, Bold, Upper | `<span className="badge">` |

