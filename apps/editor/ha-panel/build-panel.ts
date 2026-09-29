import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
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

const build = Bun.spawn(
  [
    'bun',
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
    cwd: resolve(import.meta.dir, '..'),
    stdout: 'inherit',
    stderr: 'inherit',
  },
)

const exitCode = await build.exited
if (exitCode !== 0) process.exit(exitCode)

const css = await readFile(cssSource, 'utf8')
const processed = await postcss([tailwindcss()]).process(css, {
  from: cssSource,
  to: cssOutput,
})
await writeFile(cssOutput, processed.css)

for (const file of (await readdir(outputDir)).sort()) {
  const path = resolve(outputDir, file)
  const info = await stat(path)
  if (info.isFile()) console.info(`[ha3d-panel] /${file} ${info.size} bytes`)
}
