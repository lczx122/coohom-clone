/**
 * Runtime configuration for the Coohom MCP server.
 *
 * All secrets come from environment variables so nothing sensitive is
 * committed. When wiring this into an MCP client you set these in the client's
 * server config `env` block (see README).
 */

export interface CoohomConfig {
  /** App Key issued by Coohom for your B2B application. */
  appKey: string;
  /** App Secret issued by Coohom. Used to sign requests; never logged. */
  appSecret: string;
  /**
   * API base URL. Coohom's Open APIs are hosted on www.coohom.com; regional
   * deployments may differ. Override with COOHOM_BASE_URL if Coohom gives you
   * a different host (e.g. an EU/US-specific endpoint).
   */
  baseUrl: string;
  /**
   * Signature scheme. Coohom's docs (behind login) define the exact formula.
   * We default to the widely-documented Coohom/Manycore MD5 scheme but keep it
   * switchable so you can match your account's docs without touching logic.
   * See src/sign.ts.
   */
  signScheme: SignScheme;
  /** Request timeout in milliseconds. */
  timeoutMs: number;
}

export type SignScheme = "md5-concat" | "md5-sorted-params";

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Set it in your MCP client's server "env" config (see mcp-server/README.md).`
    );
  }
  return v.trim();
}

export function loadConfig(): CoohomConfig {
  const scheme = (process.env.COOHOM_SIGN_SCHEME ?? "md5-concat") as SignScheme;
  if (scheme !== "md5-concat" && scheme !== "md5-sorted-params") {
    throw new Error(
      `Invalid COOHOM_SIGN_SCHEME "${scheme}". Use "md5-concat" or "md5-sorted-params".`
    );
  }
  return {
    appKey: required("COOHOM_APP_KEY"),
    appSecret: required("COOHOM_APP_SECRET"),
    baseUrl: (process.env.COOHOM_BASE_URL ?? "https://www.coohom.com").replace(/\/+$/, ""),
    signScheme: scheme,
    timeoutMs: Number(process.env.COOHOM_TIMEOUT_MS ?? "30000"),
  };
}
