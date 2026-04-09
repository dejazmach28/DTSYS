import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught render error', error, info)
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-500/30 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Something went wrong</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-gray-400">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-500"
          >
            Reload page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
