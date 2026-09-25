/**
 * NestJS Generate Extension
 *
 * Registers a single custom tool `nest_generate` that generates NestJS
 * artifacts in `apps/backend` by running:
 *
 *   npm exec -w apps/backend -- npx nest generate <schematic> <name>
 *
 * The schematic is validated against the supported Nest CLI schematics.
 */

import {
  type ExtensionAPI,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateTail,
} from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

const SCHEMATICS = [
  "module",
  "service",
  "provider",
  "gateway",
  "pipe",
  "filter",
  "guard",
  "interceptor",
  "controller",
  "decorator",
  "middleware",
] as const;

const NAME_PATTERN = /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/;
const TIMEOUT_MS = 120_000;

function errorResult(message: string) {
  return {
    content: [{ type: "text", text: message }],
    details: {},
    isError: true,
  };
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "nest_generate",
    label: "Nest Generate",
    description:
      `Generate a NestJS artifact in apps/backend by running \`pnpm --filter backend dlx nest generate <schematic> <name>\` from the repo root. ` +
      `The schematic must be one of: ${SCHEMATICS.join(", ")} - and MUST be created in this order. ` +
      `Output is truncated to ${formatSize(DEFAULT_MAX_BYTES)} / ${DEFAULT_MAX_LINES} lines.`,
    promptSnippet: "Generate a NestJS artifact in apps/backend via nest generate",
    promptGuidelines: [
      "Use nest_generate to create NestJS backend artifacts (controllers, services, modules, guards, pipes, etc.) instead of writing them by hand.",
    ],
    parameters: Type.Object({
      schematic: StringEnum(SCHEMATICS, {
        description: `The NestJS schematic to generate. Must be one of: ${SCHEMATICS.join(", ")}`,
      }),
      name: Type.String({
        description:
          'The name of the artifact to generate, e.g. "users" or "modules/auth". Path segments may contain letters, digits, "-" and "_", joined by "/".',
      }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const schematic = params.schematic;

      if (!SCHEMATICS.includes(schematic)) {
        return errorResult(`Unsupported schematic "${schematic}". Must be one of: ${SCHEMATICS.join(", ")}`);
      }

      const name = params.name.trim();
      if (name.length === 0) {
        return errorResult('The "name" argument must not be empty.');
      }
      if (!NAME_PATTERN.test(name)) {
        return errorResult(
          `Invalid name "${params.name}". Use path segments with letters, digits, "-" and "_", joined by "/", e.g. "users" or "modules/auth".`,
        );
      }

      const args = ["--filter", "backend", "dlx", "nest", "generate", schematic, name];

      const result = await pi.exec("npm", args, {
        cwd: ctx.cwd,
        signal,
        timeout: TIMEOUT_MS,
      });

      const combined = [result.stdout, result.stderr].filter((part) => part.trim().length > 0).join("\n").trim();
      const truncation = truncateTail(combined, { maxBytes: DEFAULT_MAX_BYTES, maxLines: DEFAULT_MAX_LINES });
      let text = truncation.content.length > 0 ? truncation.content : "(no output)";
      if (truncation.truncated) {
        text +=
          `\n\n[Output truncated: showing last ${truncation.outputLines} of ${truncation.totalLines} lines ` +
          `(${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)})]`;
      }

      const failed = result.code !== 0 || result.killed;
      if (failed) {
        text += `\n\nExit code: ${result.code}${result.killed ? " (killed)" : ""}`;
      }

      return {
        content: [{ type: "text", text }],
        details: {
          command: `pnpm ${args.join(" ")}`,
          schematic,
          name,
          exitCode: result.code,
          killed: result.killed,
          truncated: truncation.truncated,
          outputLines: truncation.totalLines,
        },
        isError: failed,
      };
    },
  });
}