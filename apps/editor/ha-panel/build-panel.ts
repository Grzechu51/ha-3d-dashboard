import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/postcss'
import postcss from 'postcss'

const outputDir = resolve(import.meta.dir, '../../../custom_components/ha_3d_dashboard/frontend')
const jsEntry = resolve(import.meta.dir, 'ha3d-panel.ts')
const tsconfig = resolve(import.meta.dir, 'tsconfig.build.json')
const cssSource = resolve(import.meta.dir, '../app/globals.css')
const cssOutput = resolve(outputDir, 'ha3d-panel.css')

await rm(outputDir, { recursive: true, force: true })
await mkdir(outputDir, { recursive: true })

const result = await Bun.build({
  entrypoints: [jsEntry],
  outdir: outputDir,
  target: 'browser',
  format: 'esm',
  tsconfig,
  minify: true,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

const css = await readFile(cssSource, 'utf8')
const processed = await postcss([tailwindcss()]).process(css, {
  from: cssSource,
  to: cssOutput,
})
await writeFile(cssOutput, processed.css)

for (const output of result.outputs) {
  console.info(
    `[ha3d-panel] ${output.path.replace(outputDir, '') || output.path} ${output.size} bytes`,
  )
}
console.info(`[ha3d-panel] /ha3d-panel.css ${Buffer.byteLength(processed.css)} bytes`)
