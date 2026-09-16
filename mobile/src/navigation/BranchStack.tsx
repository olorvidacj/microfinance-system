import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BranchStackParamList } from './types';
import { BranchHomeScreen } from '../screens/branch/BranchHomeScreen';
import { KycQueueScreen } from '../screens/branch/KycQueueScreen';
import { KycReviewDetailScreen } from '../screens/branch/KycReviewDetailScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<BranchStackParamList>();

export const BranchStack: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: 16 },
        contentStyle: { backgroundColor: colors.background },
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen name="BranchHome" component={BranchHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="KycQueue" component={KycQueueScreen} options={{ title: 'KYC Review Queue', headerBackTitle: 'Back' }} />
      <Stack.Screen name="KycReviewDetail" component={KycReviewDetailScreen} options={{ title: 'Client KYC Review' }} />
    </Stack.Navigator>
  );
};