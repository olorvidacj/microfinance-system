import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeStackParamList } from './types';
import { HomeScreen } from '../screens/client/HomeScreen';
import { KycStatusScreen } from '../screens/client/KycStatusScreen';
import { KycFormScreen } from '../screens/client/KycFormScreen';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export const HomeStack: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="KycStatus" component={KycStatusScreen} />
      <Stack.Screen name="KycForm" component={KycFormScreen} />
    </Stack.Navigator>
  );
};