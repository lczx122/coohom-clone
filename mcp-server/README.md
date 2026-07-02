# Coohom MCP Server

An [MCP](https://modelcontextprotocol.io) server that wraps the **Coohom Open
API** so an MCP client (Claude Code / Claude Desktop, or any other) can drive
Coohom design projects: create/copy/list projects, mint a single-sign-on link
into Coohom's visual editor, trigger renders, and read back the bill of
materials (BOM).

> **This is a scaffold.** It is wired end-to-end (signing → HTTP → MCP tools)
> but a few Coohom specifics — the exact endpoint paths and the precise
> signature formula — live behind Coohom's logged-in developer portal and are
> marked *(unverified)* in the code. Once you have a business account you can
> confirm them in ~5 minutes; every unverifiable value is isolated so you edit
> data, not logic. See **[Confirm against Coohom's docs](#confirm-against-coohoms-docs)**.

## What this can and can't do

Coohom's API is **project + render + BOM** oriented. It does **not** expose
granular canvas control (you can't place a wall or a cabinet at specific
coordinates through the API). The intended flow is:

1. **Create or copy a project** via the API (`coohom_create_project` /
   `coohom_copy_project`).
2. **Open the visual editor** for a human using an SSO link
   (`coohom_sso_link`) — the actual designing happens there.
3. **Trigger a render** and **fetch the result** (`coohom_trigger_render` →
   `coohom_get_render_result`).
4. **Pull the bill of materials** (`coohom_get_bom`) for quoting.

If you want an AI that genuinely *places walls and furniture programmatically*,
that's the sibling design tool in this same repo (the React app), not Coohom's
API — ask and we can expose that over MCP instead.

## Prerequisites

- Node.js 18+ (uses built-in `fetch`; developed on Node 22).
- A **Coohom B2B account with Open API access**, giving you an **App Key** and
  **App Secret**. Request access via <https://www.coohom.com/b2b/api>.

## Setup

```bash
cd mcp-server
npm install
npm run build
```

Provide credentials (either a local `.env` for manual testing, or — the normal
case — via your MCP client's `env` block):

```bash
cp .env.example .env   # then fill in COOHOM_APP_KEY / COOHOM_APP_SECRET
```

## Tools

| Tool | Purpose |
| --- | --- |
| `coohom_create_project` | Create a new design project |
| `coohom_copy_project` | Copy an existing project (template → customer design) |
| `coohom_list_projects` | List projects (optionally per app user) |
| `coohom_get_project` | Get one project's details |
| `coohom_sso_link` | Mint an SSO token/link into the Coohom editor |
| `coohom_trigger_render` | Submit a render job |
| `coohom_get_render_result` | Poll a render job's status / image URLs |
| `coohom_get_bom` | Get a project's bill of materials |

## Connecting to Claude Code

Register the built server (adjust the absolute path):

```bash
claude mcp add coohom \
  --env COOHOM_APP_KEY=your_key \
  --env COOHOM_APP_SECRET=your_secret \
  -- node /home/user/coohom-clone/mcp-server/dist/index.js
```

Or add it to your MCP client config manually:

```json
{
  "mcpServers": {
    "coohom": {
      "command": "node",
      "args": ["/home/user/coohom-clone/mcp-server/dist/index.js"],
      "env": {
        "COOHOM_APP_KEY": "your_key",
        "COOHOM_APP_SECRET": "your_secret"
      }
    }
  }
}
```

The server logs to **stderr** only (stdout is reserved for the MCP JSON-RPC
stream). It starts even without credentials, but tools return an error until
`COOHOM_APP_KEY` / `COOHOM_APP_SECRET` are set.

## Confirm against Coohom's docs

Two things to verify once you can read the logged-in portal
(open.coohom.com / developer.coohom.com):

1. **Signature formula** — `src/sign.ts`. Two documented variants are provided;
   select via `COOHOM_SIGN_SCHEME`. If yours differs, edit `computeSignature`
   only.
2. **Endpoint paths** — `src/client.ts`, the `ENDPOINTS` map. Each entry is
   marked `(unverified)`. Correct the `path` strings to match your docs; the
   tool layer and signing are unaffected.

Also double-check the exact business-param field names in the high-level
helpers in `src/client.ts` (e.g. `projectId` vs `obsProjectId`) against the
reference.

## Project layout

```
mcp-server/
  src/
    config.ts   # env-driven config (keys, base URL, sign scheme)
    sign.ts     # request signing (the one place the crypto lives)
    client.ts   # HTTP client + editable ENDPOINTS map + typed helpers
    index.ts    # MCP server: tool definitions + stdio transport
  .env.example
  package.json
  tsconfig.json
```
