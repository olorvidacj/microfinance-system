import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoansStackParamList } from './types';
import { LoansScreen } from '../screens/client/LoansScreen';
import { LoanDetailScreen } from '../screens/client/LoanDetailScreen';
import { LoanApplicationScreen } from '../screens/client/LoanApplicationScreen';
import { PaymentsScreen } from '../screens/client/PaymentsScreen';
import { PaymentReceiptScreen } from '../screens/client/PaymentReceiptScreen';

const Stack = createNativeStackNavigator<LoansStackParamList>();

export const LoansStack: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LoansList" component={LoansScreen} />
      <Stack.Screen name="LoanDetail" component={LoanDetailScreen} />
      <Stack.Screen name="LoanApplication" component={LoanApplicationScreen} />
      <Stack.Screen name="Payments" component={PaymentsScreen} />
      <Stack.Screen name="PaymentReceipt" component={PaymentReceiptScreen} />
    </Stack.Navigator>
  );
};