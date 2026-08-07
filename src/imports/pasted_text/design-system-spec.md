Act as an elite Principal UX/UI Designer and Enterprise Design Systems Architect specializing in complex SaaS applications, high-density professional dashboards, and content-heavy workflow platforms. 

Design a complete, hyper-modern, production-ready desktop web application UI in Figma for an enterprise-grade platform titled: "Automated Book & Question Bank Publishing Suite".

### Design System & Aesthetic Direction
- **Vibe:** Clean, premium, high-tech, and distraction-free (reminiscent of top-tier developer tools like Linear or Notion, combined with the professional layout precision of Adobe InDesign).
- **Color Palette:** 
  - Backgrounds: Deep slate / obsidian dark mode base (`#0F1117`, `#161B22`) with crisp, clean light mode panels (`#FFFFFF`, `#F8FAFC`).
  - Primary Accents: Electric Indigo / Vibrant Violet (`#6366F1` or `#4F46E5`) for active states and primary CTAs.
  - Status Indicators: Emerald Green (`#10B981`) for success/print-ready, Amber (`#F59E0B`) for warnings/overflow alerts, Rose (`#EF4444`) for errors.
- **Typography:** Inter or Plus Jakarta Sans. High data-density friendly, crisp line heights, meticulous font-weight hierarchy.
- **UI Components:** Glassmorphism subtle borders (`1px solid rgba(255,255,255,0.08)`), micro-interactions, clean cards with soft drop shadows, collapsible sidebar navigation, and resizable split-panes.

---

### Core Screen Layouts & Artboards to Generate

Create an organized flow across the following primary workspaces (Desktop 1440px grid):

#### 1. Global Navigation & Project Dashboard (`/dashboard`)
- **Left Sidebar (Collapsible):** Brand logo ("PubliFlow AI" or custom), links to Projects, Question Bank, Templates, Analytics, Settings, and User Profile.
- **Main Content Area:** 
  - Welcome banner with quick stats: Active Books, Total Questions Processed, Export Readiness Rate.
  - "Create New Publication" primary action button.
  - Project Cards grid: Displaying active book covers/titles (e.g., "TNPSC General Studies MCQ Bank Vol. 1"), completion percentage status tags, last modified timestamp, and size indicators (A4, B5, 8x8).

#### 2. Book & Chapter Management Hub (`/projects/[id]`)
- **Breadcrumb Navigation:** Dashboard > Project Name > Structure Editor.
- **Split-View Workspace:**
  - **Left Panel (Tree Structure):** Hierarchical view of Chapters, Sub-sections, and Question Groups with drag-and-drop handles.
  - **Right Panel (Details & Metadata):** Chapter-level configuration, target page count, assigned template style, and status indicators (Draft, Review, Print-Ready).

#### 3. High-Velocity Question Bank & Template Editor (`/editor`) — *The Core Workspace*
- **Top Toolbar:** Book title dropdown, active size selector toggle (`A4` | `B5` | `8x8`), undo/redo history, live compilation status ("Auto-saved 2s ago"), and a prominent **"Print Simulation / Export"** CTA.
- **3-Column Layout:**
  - **Column 1 (Library / Quick Inject):** Quick-access tabs for Question Blocks, Option Templates (`A, B, C, D` / `A, B, C, D, E`), Star Bulletins, and Custom Answer Structures. Drag-and-drop or shortcut injection triggers.
  - **Column 2 (Rich Text / Fast Content Entry):** High-efficiency text editor interface designed for rapid typing. Features inline syntax highlighting for correct answers, auto-numbering, and instant block-level editing without manual spacing hassles.
  - **Column 3 (Live Layout Engine & Real-Time Preview):** A live WYSIWYG pagination preview panel showing exact margins, running headers, footers, and page breaks in real-time. Includes an **Overflow Warning Badge** if text spills past the boundary grid.

#### 4. Quality Control & Verification Module (`/qc-review`)
- **Review Dashboard:** Automated validation checklist panel highlighting:
  - Number Sequence Continuity (e.g., Q101 to Q103 mismatch alerts).
  - Header & Footer Consistency Check.
  - Margin & Bleed Boundary Verification.
- **Side-by-Side Comparison:** Original content feed versus Automated Layout Engine render.

#### 5. Multi-Size Export & Print Deployment Modal (`/export`)
- **Modal Component:** Clean backdrop blur overlay.
- **Configuration Options:**
  - Format selector cards: `A4 Standard`, `B5 Academic`, `8x8 Square`.
  - Advanced Print Settings: Bleed marks, crop marks, printer-specific gutter margins.
  - Output format toggles: `High-Quality PDF/X`, `Press-Ready Package`, `Digital EPUB`.
- **Primary Action:** Large glowing **"Generate Press-Ready Files"** button with a micro-loader state.

---

### Figma Deliverables & Component Library Specs
- Build a comprehensive **Design System / UI Kit** page inside the file containing:
  - Button variants (Primary, Secondary, Ghost, Destructive) across Default, Hover, Active, and Disabled states.
  - Form controls (Inputs, Dropdowns with search filters, Toggle switches, Radio groups for template selection).
  - Status badges, tooltips, notification toast alerts, and modal dialog containers.
  - Layout grid components configured with 8px spacing rules and auto-layout enabled across all frames.