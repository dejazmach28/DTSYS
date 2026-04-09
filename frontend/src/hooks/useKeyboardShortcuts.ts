import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useGlobalSearchStore } from '../store/globalSearchStore'

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  const tag = target.tagName.toLowerCase()
  return target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select'
}

export function useKeyboardShortcuts(enabled = true) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const openSearch = useGlobalSearchStore((state) => state.openSearch)
  const closeSearch = useGlobalSearchStore((state) => state.closeSearch)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    let pendingPrefix: 'g' | null = null
    let prefixTimer: number | undefined

    const clearPrefix = () => {
      pendingPrefix = null
      if (prefixTimer) {
        window.clearTimeout(prefixTimer)
        prefixTimer = undefined
      }
    }

    const closeModals = () => {
      closeSearch()
      setShowHelp(false)
      window.dispatchEvent(new CustomEvent('dtsys:close-modals'))
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openSearch()
        return
      }

      if (event.key === 'Escape') {
        closeModals()
        clearPrefix()
        return
      }

      if (isTypingTarget(event.target)) {
        return
      }

      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault()
        setShowHelp(true)
        clearPrefix()
        return
      }

      if (event.key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        void queryClient.invalidateQueries()
        clearPrefix()
        return
      }

      const key = event.key.toLowerCase()
      if (pendingPrefix === 'g') {
        if (key === 'd') {
          navigate('/')
          event.preventDefault()
        } else if (key === 'a') {
          navigate('/alerts')
          event.preventDefault()
        } else if (key === 'r') {
          navigate('/reports')
          event.preventDefault()
        } else if (key === 's') {
          navigate('/settings')
          event.preventDefault()
        }
        clearPrefix()
        return
      }

      if (key === 'g' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        pendingPrefix = 'g'
        prefixTimer = window.setTimeout(clearPrefix, 1000)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      clearPrefix()
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [closeSearch, enabled, navigate, openSearch, queryClient])

  return {
    showHelp,
    closeHelp: () => setShowHelp(false),
  }
}
