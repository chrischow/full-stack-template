import { access, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const backend = dirname(fileURLToPath(import.meta.url))
const entry = join(backend, 'dist', 'main.js')
const output = join(backend, 'dist', 'lambda.cjs')

try {
  await access(entry)
} catch {
  throw new Error(`Missing ${entry}: run the backend Nest build before bundling.`)
}

await mkdir(dirname(output), { recursive: true })

// Bundle the emitted Nest modules, keeping their TypeScript decorator metadata.
// Externalize package imports: Prisma's generated client loads query compiler and
// WASM files dynamically. The ZIP must include production dependencies plus the
// compiled @repo/db (including dist/generated) and @repo/api-contract packages.
await build({
  entryPoints: [entry],
  outfile: output,
  bundle: true,
  packages: 'external',
  platform: 'node',
  target: 'node22',
  format: 'cjs',
})
