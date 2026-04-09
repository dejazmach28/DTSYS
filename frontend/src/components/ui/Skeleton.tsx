function BaseSkeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 dark:bg-gray-800 ${className}`} />
}

export function SkeletonText({ className = 'h-4 w-full' }: { className?: string }) {
  return <BaseSkeleton className={className} />
}

export function SkeletonMetric() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <SkeletonText className="h-3 w-20" />
      <SkeletonText className="mt-3 h-8 w-24" />
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between">
        <SkeletonText className="h-4 w-24" />
        <SkeletonText className="h-5 w-14 rounded-full" />
      </div>
      <SkeletonText className="mt-4 h-3 w-32" />
      <SkeletonText className="mt-2 h-3 w-24" />
      <SkeletonText className="mt-6 h-10 w-full" />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          <SkeletonText className="h-4 w-full" />
          <SkeletonText className="h-4 w-full" />
          <SkeletonText className="h-4 w-full" />
        </div>
      ))}
    </div>
  )
}
