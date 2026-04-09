import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import GlobalSearch from '../ui/GlobalSearch'
import { useLayoutStore } from '../../store/layoutStore'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'

export default function Layout() {
  const mobileSidebarOpen = useLayoutStore((state) => state.mobileSidebarOpen)
  const closeSidebar = useLayoutStore((state) => state.closeSidebar)
  const { showHelp, closeHelp } = useKeyboardShortcuts()

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-gray-950 dark:text-gray-100">
      <Sidebar className="hidden md:flex" />
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <button
            onClick={closeSidebar}
            className="flex-1 bg-slate-950/40"
            aria-label="Close sidebar"
          />
          <Sidebar className="relative z-50 h-full shadow-xl" onNavigate={closeSidebar} />
        </div>
      )}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
      <GlobalSearch />
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Keyboard Shortcuts</h2>
                <p className="text-sm text-slate-500 dark:text-gray-500">Navigation and quick actions available globally.</p>
              </div>
              <button
                onClick={closeHelp}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 dark:border-gray-700 dark:text-gray-300"
              >
                Close
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-800">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500 dark:bg-gray-950/60 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2">Shortcut</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Ctrl/Cmd + K', 'Open global search'],
                    ['G then D', 'Go to dashboard'],
                    ['G then A', 'Go to alerts'],
                    ['G then R', 'Go to reports'],
                    ['G then S', 'Go to settings'],
                    ['R', 'Refresh current page data'],
                    ['Escape', 'Close open overlays'],
                    ['?', 'Open this help modal'],
                  ].map(([shortcut, action]) => (
                    <tr key={shortcut} className="border-t border-slate-200 dark:border-gray-800">
                      <td className="px-3 py-2 font-mono text-slate-700 dark:text-gray-200">{shortcut}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-gray-300">{action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
