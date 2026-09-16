import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NotificationsStackParamList } from './types';
import { NotificationsScreen } from '../screens/client/NotificationsScreen';

const Stack = createNativeStackNavigator<NotificationsStackParamList>();

export const NotificationsStack: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
};