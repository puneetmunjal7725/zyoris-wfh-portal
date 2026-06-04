function escapeCell(v) {
  const s = String(v ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function rowsToCsv(headers, rows) {
  const head = headers.map((h) => escapeCell(h.label)).join(',')
  const body = rows.map((row) => headers.map((h) => escapeCell(row[h.key])).join(','))
  return `\ufeff${[head, ...body].join('\r\n')}`
}

export function downloadTextFile(filename, content, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadCsv(filename, headers, rows) {
  downloadTextFile(filename.endsWith('.csv') ? filename : `${filename}.csv`, rowsToCsv(headers, rows))
}

/** Excel opens tab-separated UTF-8 files saved as .xls */
export function downloadExcel(filename, headers, rows) {
  const tsv = rowsToCsv(headers, rows).replace(/,/g, '\t')
  downloadTextFile(
    filename.endsWith('.xls') ? filename : `${filename}.xls`,
    tsv,
    'application/vnd.ms-excel;charset=utf-8',
  )
}
