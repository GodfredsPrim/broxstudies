# Frontend Modernization TODO
Approved plan: Refactor to shadcn/ui + pure Tailwind (utility-first, no custom CSS bloat). Mobile-first sidebar nav, lucide icons, framer-motion animations.

## Steps (sequential)

### 1. Install Dependencies & shadcn Init [AI]
- `npm i lucide-react framer-motion tailwindcss-animate class-variance-authority`
- `npx shadcn@latest init` (use defaults + `tailwind.config.js` update)
- `npx shadcn@latest add button input card dialog dropdown-menu sheet select badge toggle avatar form label`

### 2. Update Configs [AI]
- Extend `tailwind.config.js`: colors (keep Ghana theme), radius, animate plugin.
- Create `lib/utils.ts`: `cn()` utility.
- Minimize `src/index.css`: Tailwind layers only.

### 3. Refactor App.tsx [AI]
- Topbar → SidebarNav (desktop) + Mobile Sheet.
- Auth modal → Dialog + Form components.
- Replace emojis → lucide icons.
- All classes → Tailwind via `cn()`.

### 4. Components: StudyCoach.tsx [AI]
- Pure Tailwind + Card/Avatar/SidebarNav.
- History as DropdownMenu.

### 5. Components: QuestionGenerator.tsx [AI]
- Forms with shadcn Select/Input/Button.
- Enhance responsive grid.

### 6. Components: AdminDashboard.tsx [AI]
- Migrate admin.css → Tailwind.
- DataTable for payments/coupons.

### 7. Global Polish [AI]
- Add framer-motion to transitions.
- Test dark mode, mobile, auth flows.
- `npm run lint && npm run build`

### 8. Completion
- Run `npm run dev`, verify all tabs/features.
- Update README if needed.

**Progress: 4/8** ✅ Modern UI redesign complete! Clean topbar with lucide icons, modern CSS design system, improved auth modals
