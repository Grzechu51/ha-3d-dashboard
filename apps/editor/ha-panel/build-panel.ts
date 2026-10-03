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
const jsOutput = resolve(outputDir, 'ha3d-panel.js')
const browserProcessPrelude = `;var process = (globalThis.process ??= { env: {} });
process.env ??= {};
process.env.NODE_ENV ??= 'production';`

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

const browserBundle = await readFile(jsOutput, 'utf8')
const processEnvReferences = browserBundle.split('process.env').length - 1
const iconReferences = browserBundle.split('/icons/').length - 1
const browserBundleForHa = browserBundle.replaceAll('/icons/', '/ha3d_static/icons/')
await writeFile(jsOutput, `${browserProcessPrelude}\n${browserBundleForHa}`)
console.info(
  `[ha3d-panel] injected browser process.env shim; bundle contains ${processEnvReferences} process.env reference(s)`,
)
console.info(`[ha3d-panel] rewrote ${iconReferences} /icons/ reference(s) to /ha3d_static/icons/`)

const css = await readFile(cssSource, 'utf8')
const tailwindPlugin = tailwindcss() as unknown as AcceptedPlugin
const processed = await postcss([tailwindPlugin]).process(css, {
  from: cssSource,
  to: cssOutput,
})
await writeFile(cssOutput, processed.css.replaceAll('/icons/', '/ha3d_static/icons/'))

for (const file of (await readdir(outputDir)).sort()) {
  const path = resolve(outputDir, file)
  const info = await stat(path)
  if (info.isFile()) console.info(`[ha3d-panel] /${file} ${info.size} bytes`)
}
