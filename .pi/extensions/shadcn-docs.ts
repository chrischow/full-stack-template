import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execSync } from "node:child_process";

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "shadcn_docs",
    label: "Get shadcn Component Doc",
    description: `Use this tool to look up shadcn documentation on a component in the frontend by running: npx shadcn@latest docs [component].`,
    promptSnippet: "Get docs for shadcn component",
    promptGuidelines: [
      "Use shadcn_docs to get documentation on a shadcn component.",
    ],
    parameters: Type.Object({
      component: Type.String({
        description: `Component name passed to the shadcn docs command.`,
      }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const component = params.component as string;

      try {
        const componentArg = component ? ` ${shellQuote(component)}` : "";
        const output = execSync(`pnpm --filter frontend dlx shadcn@latest docs ${componentArg}`, {
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
