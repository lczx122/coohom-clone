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
- Draw chained walls — **left-click** to add points, **right-click** to finish and
  switch back to the cursor. Walls snap to the grid and to existing corners.
- Draw at any angle freely; **hold Shift** to snap to right angles. When the new
  segment starts at an existing corner, a live **angle indicator** shows the
  angle between the two walls.
- **Hold Space** to temporarily pan; release to return to your previous tool.
- **Editable measurements**: select a wall and type its exact length right on the
  plan (or in Properties). Resizing moves the shared corner so rooms stay closed.
- **Rooms**: enclose an area with walls and it's detected automatically — the
  floor area is shown and you can click the room to rename it.
- Units default to **millimeters** (switch to meters in the top bar).
- Add **doors** and **windows** by clicking on a wall (with swing/symbol drawn).
- Drag walls, drag wall corners, and reposition openings along a wall.
- Place **catalog products** (cabinets, seating, tables, appliances) and move /
  rotate them.
- Undo / redo, snap & ortho toggles, zoom & pan, and JSON **Import / Export**.

**Cabinet maker**
- Place a **custom cabinet** (sidebar → *Custom Cabinets → + New cabinet*) and
  double-click it (or *Edit cabinet…*) to open the **Cabinet Editor**.
- Live 3D preview while you configure: width / height / depth, panel thickness,
  **material & color**, **doors** (none / single-left / single-right / double)
  and **hinge type**, shelves, and **accessories** (drawer, pull-out trash bin,
  dish basket, cutlery tray, wine rack, baskets, spice pull-out) with a height
  slider each. A running price estimate updates as you build.
- **Save as Model** stores the cabinet under *My Cabinets* so you can drop more
  copies onto any plan. Models persist across projects.
- Configuration lives in `src/data/cabinet.ts` (materials, hinges, accessories);
  the 3D renderer is `src/components/CabinetModel.tsx`.

**Projects**
- Create, switch, rename, and delete multiple named projects from the top bar.
  Everything auto-saves to your browser's local storage. Persistence is isolated
  in `src/lib/storage.ts` so it can be swapped for a cloud database later.

**3D preview**
- One click switches to a 3D view that extrudes walls to height and renders
  placed products and cabinets as solids.
- **Move the camera freely**: **WASD** to move, **Q/E** for up/down, **Shift**
  to move faster, mouse-drag to look, scroll to zoom.
- Enclosed rooms get **standard wood flooring** automatically.

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
