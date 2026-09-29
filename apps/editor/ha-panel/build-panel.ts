import { spawn } from 'node:child_process'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/postcss'
import postcss, { type AcceptedPlugin } from 'postcss'

const here = dirname(fileURLToPath(import.meta.url))
const outputDir = resolve(here, '../../../custom_components/ha_3d_dashboard/frontend')
const jsEntry = resolve(here, 'ha3d-panel.ts')
const tsconfig = resolve(here, 'tsconfig.build.json')
const cssSource = resolve(here, '../app/globals.css')
const cssOutput = resolve(outputDir, 'ha3d-panel.css')

await rm(outputDir, { recursive: true, force: true })
await mkdir(outputDir, { recursive: true })

const exitCode = await new Promise<number>((resolveExit, reject) => {
  const child = spawn(
    'bun',
    [
      'build',
      jsEntry,
      '--target',
      'browser',
      '--format',
      'esm',
      '--tsconfig-override',
      tsconfig,
      '--outdir',
      outputDir,
      '--minify',
      '--define',
      'process.env.NODE_ENV="production"',
    ],
    {
      cwd: resolve(here, '..'),
      stdio: 'inherit',
    },
  )

  child.once('error', reject)
  child.once('close', (code) => resolveExit(code ?? 1))
})

if (exitCode !== 0) process.exit(exitCode)

const css = await readFile(cssSource, 'utf8')
const tailwindPlugin = tailwindcss() as unknown as AcceptedPlugin
const processed = await postcss([tailwindPlugin]).process(css, {
  from: cssSource,
  to: cssOutput,
})
await writeFile(cssOutput, processed.css)

for (const file of (await readdir(outputDir)).sort()) {
  const path = resolve(outputDir, file)
  const info = await stat(path)
  if (info.isFile()) console.info(`[ha3d-panel] /${file} ${info.size} bytes`)
}
