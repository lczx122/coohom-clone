# Floor Planner — a company-tailored Coohom-style design tool

A browser-based interior design tool for a **furniture / cabinet retailer**. The
v1 core is a **2D floor plan editor** with a live **3D preview** and a branded,
tailorable **product catalog**. Built with React + TypeScript + Vite, with
Three.js (via react-three-fiber) for the 3D view.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
npm run typecheck  # types only
```

## What you can do

**2D editor (the core)**
- Draw chained walls — click to add segments, double-click / Esc / right-click to
  finish. Walls snap to the grid and to existing corners.
- Add **doors** and **windows** by clicking on a wall (with swing/symbol drawn).
- Drag walls, drag wall endpoints, and reposition openings along a wall.
- Place **catalog products** (cabinets, seating, tables, appliances) and move /
  rotate them.
- Edit precise dimensions in the **Properties** panel.
- Undo / redo, snap toggle, zoom & pan, and JSON **Import / Export**. The plan
  auto-saves to your browser's local storage.

**3D preview**
- One click switches to a 3D view that extrudes walls to height and renders
  placed products as solids. Orbit / zoom / pan with the mouse.

**Keyboard shortcuts**
- `V` select · `W` wall · `D` door · `N` window · `H` pan
- `R` rotate selected product · `Delete` remove selection
- `Ctrl/Cmd+Z` undo · `Ctrl/Cmd+Shift+Z` redo

## Deploying to Vercel

This repo is configured for zero-config deploys to [Vercel](https://vercel.com)
(see `vercel.json`). To get a live URL:

1. Go to **https://vercel.com/new** and sign in with GitHub.
2. **Import** the `lczx122/coohom-clone` repository.
3. Vercel auto-detects the settings from `vercel.json`:
   - Framework: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
4. Under **Branch**, you can deploy this feature branch
   (`claude/dazzling-darwin-czbfth`) directly, or merge it to `main` first and
   deploy that. Every later push to the connected branch redeploys automatically.
5. Click **Deploy**. You'll get a public URL like
   `https://coohom-clone.vercel.app`.

No environment variables or secrets are required — it's a fully static build.

## Tailoring it to your company

This is built to be re-skinned for a specific retailer:

- **Branding & defaults** — `src/config/company.ts`: company name, tagline,
  brand color, currency, and default wall/door/window dimensions.
- **Product catalog** — `src/data/catalog.ts`: your real SKUs, categories,
  dimensions (in meters), colors, and prices. Everything in the sidebar,
  pricing totals, and 3D view comes from here.

## Architecture

```
src/
  config/company.ts        # company branding + defaults (tailor here)
  data/catalog.ts          # product inventory (tailor here)
  types.ts                 # domain model (walls, openings, items, products)
  lib/geometry.ts          # snapping, projection, area, ids
  store/useDesignStore.ts  # Zustand store: document + history + persistence
  components/
    Toolbar.tsx            # tools, undo/redo, import/export, 2D/3D toggle
    Catalog.tsx            # branded product sidebar
    FloorPlanCanvas.tsx    # the 2D editor (HTML canvas)
    View3D.tsx             # Three.js / react-three-fiber 3D preview
    PropertiesPanel.tsx    # edit the selected element
    StatusBar.tsx          # counts, wall length, estimated total, snap, zoom
```

All spatial coordinates are stored in **meters**; the canvas and 3D view convert
to screen/world units at render time.

## Possible next steps

- Auto-detect closed rooms and label floor area / flooring cost.
- Wall-aware product snapping (cabinets clinging to walls; counter runs).
- Save named projects to a backend instead of local storage.
- Photorealistic rendering / export to PDF quote with the product list.
