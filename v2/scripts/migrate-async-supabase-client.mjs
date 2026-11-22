import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const roots = ['app', 'lib']
const excluded = new Set(['lib/supabase/server.ts'])
let changedFiles = 0
let changedCalls = 0

async function visit(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await visit(path)
      continue
    }
    if (!/\\.tsx?$/.test(entry.name)) continue
    const relativePath = relative('.', path).replaceAll('\\\\', '/')
    if (excluded.has(relativePath)) continue

    const source = await readFile(path, 'utf8')
    let replacements = 0
    const updated = source.replace(/(?<!await\\s)createSupabaseServerClient\\(\\)/g, () => {
      replacements += 1
      return 'await createSupabaseServerClient()'
    })
    if (replacements > 0) {
      await writeFile(path, updated)
      changedFiles += 1
      changedCalls += replacements
    }
  }
}

for (const root of roots) await visit(root)
console.log(`Ensured async Supabase client calls: ${changedCalls} call(s) across ${changedFiles} file(s).`)
