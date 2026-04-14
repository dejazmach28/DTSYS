import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Text } from 'react-native'
import DashboardScreen from '../screens/DashboardScreen'
import DeviceDetailScreen from '../screens/DeviceDetailScreen'
import AlertsScreen from '../screens/AlertsScreen'
import SettingsScreen from '../screens/SettingsScreen'

type StackParamList = {
  DeviceList: undefined
  DeviceDetail: { deviceId: string; hostname: string }
}

type TabParamList = {
  Dashboard: undefined
  Alerts: undefined
  Settings: undefined
}

interface AppNavigatorProps {
  onLogout: () => void
}

const Stack = createNativeStackNavigator<StackParamList>()
const Tab = createBottomTabNavigator<TabParamList>()

function DevicesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="DeviceList"
        component={DashboardScreen}
        options={{ title: 'Devices', headerLargeTitle: true }}
      />
      <Stack.Screen
        name="DeviceDetail"
        component={DeviceDetailScreen}
        options={({ route }) => ({ title: route.params.hostname })}
      />
    </Stack.Navigator>
  )
}

export default function AppNavigator({ onLogout }: AppNavigatorProps) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, string> = {
            Dashboard: '📱',
            Alerts: '🔔',
            Settings: '⚙️',
          }
          return <Text style={{ fontSize: size * 0.8 }}>{icons[route.name]}</Text>
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DevicesStack} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen
        name="Settings"
        options={{ headerShown: true }}
      >
        {() => <SettingsScreen onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  )
}
