import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import GlobalSearch from '../ui/GlobalSearch'
import { useLayoutStore } from '../../store/layoutStore'

export default function Layout() {
  const mobileSidebarOpen = useLayoutStore((state) => state.mobileSidebarOpen)
  const closeSidebar = useLayoutStore((state) => state.closeSidebar)

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
    </div>
  )
}
