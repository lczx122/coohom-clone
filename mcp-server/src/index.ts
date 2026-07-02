#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { CoohomClient, CoohomApiError } from "./client.js";

/**
 * Coohom MCP server.
 *
 * Exposes the Coohom Open API as MCP tools so an MCP client (Claude, etc.) can
 * manage Coohom design projects: create/copy/list/get projects, mint an SSO
 * link so a human can open the visual editor, trigger renders, and read back
 * the bill of materials.
 *
 * NOTE on scope: Coohom's API is project + render + BOM oriented. The actual
 * visual designing (placing walls / furniture) happens inside Coohom's own
 * embedded editor, reached via the SSO link this server can mint — the API
 * does not expose granular canvas manipulation. See README.
 */

const server = new McpServer({
  name: "coohom-mcp-server",
  version: "0.1.0",
});

// Lazily construct the client so `--help`-style listing works even without
// credentials; the error only surfaces when a tool is actually invoked.
let clientErr: Error | null = null;
let client: CoohomClient | null = null;
try {
  client = new CoohomClient(loadConfig());
} catch (e) {
  clientErr = e as Error;
}

function requireClient(): CoohomClient {
  if (!client) {
    throw new Error(
      (clientErr?.message ?? "Coohom client not configured.") +
        "\n\nThis MCP server needs COOHOM_APP_KEY and COOHOM_APP_SECRET. " +
        "Add them to the server's env config and restart."
    );
  }
  return client;
}

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const data = await fn();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (err) {
    const msg =
      err instanceof CoohomApiError
        ? `${err.message}\n(HTTP ${err.httpStatus}, code ${err.code ?? "n/a"})`
        : (err as Error).message;
    return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
  }
}

server.tool(
  "coohom_create_project",
  "Create a new Coohom design project. Returns the new project id. To let a " +
    "person design in it, mint an SSO link with coohom_sso_link.",
  {
    name: z.string().describe("Human-readable project name."),
    appuid: z
      .string()
      .optional()
      .describe("Your app's user id to own the project (for multi-user integrations)."),
    floorplanId: z.string().optional().describe("Optional floor-plan template id to seed the project."),
  },
  async (args) => run(() => requireClient().createProject(args))
);

server.tool(
  "coohom_copy_project",
  "Copy an existing Coohom project into a new one (common pattern for seeding " +
    "a customer design from a template). Returns the new project id.",
  {
    sourceProjectId: z.string().describe("Project id to copy from."),
    name: z.string().optional().describe("Name for the copy."),
    appuid: z.string().optional().describe("Owner user id for the copy."),
  },
  async (args) => run(() => requireClient().copyProject(args))
);

server.tool(
  "coohom_list_projects",
  "List Coohom projects, optionally scoped to one app user.",
  {
    appuid: z.string().optional().describe("Filter to this app user's projects."),
    page: z.number().int().positive().optional().describe("1-based page number."),
    pageSize: z.number().int().positive().max(100).optional().describe("Items per page."),
  },
  async (args) => run(() => requireClient().listProjects(args))
);

server.tool(
  "coohom_get_project",
  "Get details for a single Coohom project.",
  { projectId: z.string().describe("Project id.") },
  async (args) => run(() => requireClient().getProject(args))
);

server.tool(
  "coohom_sso_link",
  "Mint a single-sign-on token/link so a human can open the Coohom visual " +
    "editor for their account. The actual designing (walls, furniture) is done " +
    "there — the API cannot manipulate the canvas directly.",
  { appuid: z.string().describe("Your app's user id to sign the person in as.") },
  async (args) => run(() => requireClient().ssoToken(args.appuid))
);

server.tool(
  "coohom_trigger_render",
  "Submit a render job for a project. Returns a render id to poll with " +
    "coohom_get_render_result.",
  {
    projectId: z.string().describe("Project to render."),
    type: z.string().optional().describe("Render type/preset if your account supports it."),
    width: z.number().int().positive().optional().describe("Output width in pixels."),
    height: z.number().int().positive().optional().describe("Output height in pixels."),
  },
  async (args) => run(() => requireClient().triggerRender(args))
);

server.tool(
  "coohom_get_render_result",
  "Fetch the status/result (image URLs) of a previously submitted render.",
  { renderId: z.string().describe("Render id returned by coohom_trigger_render.") },
  async (args) => run(() => requireClient().getRenderResult(args))
);

server.tool(
  "coohom_get_bom",
  "Get the bill of materials (product list, quantities, pricing) for a project.",
  { projectId: z.string().describe("Project id.") },
  async (args) => run(() => requireClient().getBom(args))
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so it never corrupts the stdio JSON-RPC stream on stdout.
  console.error(
    "coohom-mcp-server running on stdio" +
      (clientErr ? " (WARNING: credentials not set — tools will error until configured)" : "")
  );
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
