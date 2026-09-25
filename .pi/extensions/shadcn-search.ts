import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execSync } from "node:child_process";

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "shadcn_search",
    label: "Search shadcn Documentation",
    description: `Use this tool to search the shadcn registry for documentation using a keyword by running: npx shadcn@latest search @shadcn -q [query].`,
    promptSnippet: "Get docs for shadcn component",
    promptGuidelines: [
      "Use shadcn_search to search the shadcn documentation.",
    ],
    parameters: Type.Object({
      query: Type.String({
        description: `Query for the shadcn documentation search.`,
      }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const query = params.query as string;

      try {
        const queryArg = query ? ` ${shellQuote(query)}` : "";
        const output = execSync(`pnpm --filter frontend dlx shadcn@latest search @shadcn -q ${queryArg}`, {
          cwd: ctx.cwd,
          encoding: "utf-8",
          signal,
        });

        return {
          content: [{ type: "text", text: output }],
          details: {},
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: message }],
          details: {},
          isError: true,
        };
      }
    },
  });
}
