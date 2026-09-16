import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ClientTabParamList } from './types';
import { HomeStack } from './HomeStack';
import { LoansStack } from './LoansStack';
import { SavingsStack } from './SavingsStack';
import { NotificationsStack } from './NotificationsStack';
import { MoreStack } from './MoreStack';
import { colors } from '../theme';

const Tab = createBottomTabNavigator<ClientTabParamList>();

const ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  HomeTab: { active: 'home', inactive: 'home-outline' },
  LoansTab: { active: 'wallet', inactive: 'wallet-outline' },
  SavingsTab: { active: 'wallet', inactive: 'wallet-outline' },
  NotificationsTab: { active: 'notifications', inactive: 'notifications-outline' },
  MoreTab: { active: 'grid', inactive: 'grid-outline' },
};

export const ClientTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = ICONS[route.name] ?? { active: 'ellipsis-horizontal', inactive: 'ellipsis-horizontal-outline' };
          return (
            <Ionicons
              name={focused ? icons.active : icons.inactive}
              size={size - 1}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: 'Home' }} />
      <Tab.Screen name="LoansTab" component={LoansStack} options={{ title: 'Loans' }} />
      <Tab.Screen name="SavingsTab" component={SavingsStack} options={{ title: 'Savings' }} />
      <Tab.Screen name="NotificationsTab" component={NotificationsStack} options={{ title: 'Alerts' }} />
      <Tab.Screen name="MoreTab" component={MoreStack} options={{ title: 'More' }} />
    </Tab.Navigator>
  );
};