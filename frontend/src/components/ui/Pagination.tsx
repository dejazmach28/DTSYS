interface Props {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

export default function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) {
    return null
  }

  const pages = buildPages(page, totalPages)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
      >
        Previous
      </button>
      {pages.map((value, index) =>
        value === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="px-2 text-sm text-slate-400 dark:text-gray-500">
            ...
          </span>
        ) : (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              value === page
                ? 'bg-blue-600 text-white'
                : 'border border-slate-200 text-slate-600 dark:border-gray-700 dark:text-gray-300'
            }`}
          >
            {value}
          </button>
        )
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
      >
        Next
      </button>
    </div>
  )
}

function buildPages(current: number, total: number): Array<number | 'ellipsis'> {
  const values = new Set<number>([1, total, current - 1, current, current + 1, current - 2, current + 2])
  const sorted = Array.from(values).filter((value) => value >= 1 && value <= total).sort((a, b) => a - b)
  const result: Array<number | 'ellipsis'> = []
  for (const value of sorted) {
    const previous = result[result.length - 1]
    if (typeof previous === 'number' && value - previous > 1) {
      result.push('ellipsis')
    }
    result.push(value)
  }
  return result
}
