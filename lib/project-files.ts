/**
 * Çok dosyalı projeler.
 *
 * Proje `files` alanında dosya listesi tutulur:
 *   [{ path: 'index.html', content: '...' }, { path: 'css/style.css', content: '...' }]
 *
 * Önizleme ve paylaşım için bu dosyalar tek bir HTML belgesine birleştirilir;
 * yerel <link rel="stylesheet"> ve <script src> etiketleri içeriğiyle değiştirilir.
 */

export type ProjectFile = {
  path: string
  content: string
}

export const TEXT_FILE_PATTERN = /\.(html?|css|js|mjs|json|txt|md|svg|xml)$/i

function normalizePath(path: string) {
  return String(path || '')
    .trim()
    .replace(/^\.?\//, '')
    .replace(/\\/g, '/')
    .toLowerCase()
}

/** Veritabanından gelen değerin dosya listesi olup olmadığını anlar. */
export function asProjectFiles(value: unknown): ProjectFile[] | null {
  if (!Array.isArray(value)) return null

  const files = value
    .filter(
      (item) =>
        item &&
        typeof item.path === 'string' &&
        item.path.trim() &&
        typeof item.content === 'string'
    )
    .map((item) => ({ path: item.path.trim(), content: item.content }))

  return files.length ? files : null
}

/** Tek bir HTML belgesini HTML/CSS/JS parçalarına ayırır. */
export function splitDocument(documentText: string) {
  let html = String(documentText || '').trim()
  let css = ''
  let js = ''

  const style = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(html)

  if (style) {
    css = style[1].trim()
    html = html.replace(style[0], '')
  }

  const scripts: string[] = []

  html = html.replace(
    /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi,
    (_match, body) => {
      if (String(body).trim()) scripts.push(String(body).trim())
      return ''
    }
  )

  js = scripts.join('\n\n')

  return { html: html.trim(), css, js }
}

export function entryFile(files: ProjectFile[]): ProjectFile | null {
  return (
    files.find((file) => /^index\.html?$/i.test(file.path)) ||
    files.find((file) => /(^|\/)index\.html?$/i.test(file.path)) ||
    files.find((file) => /\.html?$/i.test(file.path)) ||
    null
  )
}

/** Dosyaları tarayıcıda çalışan tek bir HTML belgesine çevirir. */
export function bundleFiles(files: ProjectFile[]): string {
  const entry = entryFile(files)

  if (!entry) return ''

  const byPath = new Map<string, string>()

  for (const file of files) {
    byPath.set(normalizePath(file.path), file.content)
  }

  let documentText = entry.content

  // Yerel stil dosyalarını belgeye göm.
  documentText = documentText.replace(
    /<link\b[^>]*>/gi,
    (tag) => {
      if (!/stylesheet/i.test(tag)) return tag

      const href = /href=["']([^"']+)["']/i.exec(tag)?.[1]
      const target = href ? byPath.get(normalizePath(href)) : undefined

      return target === undefined ? tag : `<style>\n${target}\n</style>`
    }
  )

  // Yerel script dosyalarını belgeye göm.
  documentText = documentText.replace(
    /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (tag, before, src, after) => {
      const target = byPath.get(normalizePath(src))

      if (target === undefined) return tag

      return `<script${before}${after}>\n${target.replace(/<\/script/gi, '<\\/script')}\n</script>`
    }
  )

  return documentText
}

/** Eski üç sütunlu projeyi dosya listesine çevirir. */
export function splitToFiles(
  html: string,
  css: string,
  js: string,
  title = 'Projem'
): ProjectFile[] {
  const files: ProjectFile[] = []
  let documentText = (html || '').trim()

  if (!documentText) {
    documentText = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body>

</body>
</html>`
  }

  const hasDocument = /<html[\s>]/i.test(documentText)

  if (!hasDocument) {
    documentText = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body>
${documentText}
</body>
</html>`
  }

  if (css.trim()) {
    if (/<\/head>/i.test(documentText)) {
      documentText = documentText.replace(
        /<\/head>/i,
        '<link rel="stylesheet" href="style.css">\n</head>'
      )
    } else {
      documentText = `<link rel="stylesheet" href="style.css">\n${documentText}`
    }

    files.push({ path: 'style.css', content: css })
  }

  if (js.trim()) {
    const scriptTag = '<script src="app.js"></script>'

    if (/<\/body>/i.test(documentText)) {
      documentText = documentText.replace(/<\/body>/i, `${scriptTag}\n</body>`)
    } else {
      documentText = `${documentText}\n${scriptTag}`
    }

    files.push({ path: 'app.js', content: js })
  }

  return [{ path: 'index.html', content: documentText }, ...files]
}
