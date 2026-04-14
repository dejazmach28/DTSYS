import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { useAuth } from './src/hooks/useAuth'
import LoginScreen from './src/screens/LoginScreen'
import AppNavigator from './src/navigation/AppNavigator'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
    },
  },
})

function AppContent() {
  const { checkAuth, logout } = useAuth()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    checkAuth().then(setIsAuthenticated)
  }, [checkAuth])

  const handleLoginSuccess = useCallback(() => setIsAuthenticated(true), [])
  const handleLogout = useCallback(async () => {
    await logout()
    queryClient.clear()
    setIsAuthenticated(false)
  }, [logout])

  if (isAuthenticated === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <NavigationContainer>
      <AppNavigator onLogout={handleLogout} />
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <AppContent />
    </QueryClientProvider>
  )
}
