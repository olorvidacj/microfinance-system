import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SavingsStackParamList } from './types';
import { SavingsScreen } from '../screens/client/SavingsScreen';

const Stack = createNativeStackNavigator<SavingsStackParamList>();

export const SavingsStack: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Savings" component={SavingsScreen} />
    </Stack.Navigator>
  );
};