import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/postcss'
import postcss from 'postcss'

const source = resolve(import.meta.dir, '../app/globals.css')
const output = resolve(
  import.meta.dir,
  '../../../custom_components/ha_3d_dashboard/frontend/ha3d-panel.css',
)

const css = await readFile(source, 'utf8')
const result = await postcss([tailwindcss()]).process(css, {
  from: source,
  to: output,
})

await writeFile(output, result.css)
