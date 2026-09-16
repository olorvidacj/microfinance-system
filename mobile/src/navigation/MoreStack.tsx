import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MoreStackParamList } from './types';
import { MoreScreen } from '../screens/client/MoreScreen';
import { ProfileScreen } from '../screens/client/ProfileScreen';
import { SettingsScreen } from '../screens/client/SettingsScreen';
import { GroupLendingScreen } from '../screens/client/GroupLendingScreen';
import { TransactionsScreen } from '../screens/client/TransactionsScreen';
import { DocumentsScreen } from '../screens/client/DocumentsScreen';
import { HelpSupportScreen } from '../screens/client/HelpSupportScreen';
import { KycStatusScreen } from '../screens/client/KycStatusScreen';
import { KycFormScreen } from '../screens/client/KycFormScreen';

const Stack = createNativeStackNavigator<MoreStackParamList>();

export const MoreStack: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="More" component={MoreScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="GroupLending" component={GroupLendingScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="Documents" component={DocumentsScreen} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <Stack.Screen name="KycStatus" component={KycStatusScreen} />
      <Stack.Screen name="KycForm" component={KycFormScreen} />
    </Stack.Navigator>
  );
};