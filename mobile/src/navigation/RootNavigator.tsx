import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { AuthNavigator } from './AuthNavigator';
import { ClientTabs } from './ClientTabs';
import { BranchStack } from './BranchStack';
import { SplashScreen } from '../screens/SplashScreen';
import { colors } from '../theme';

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

export const RootNavigator: React.FC = () => {
  const { isReady, session, isBranchPersonnel } = useAuth();

  return (
    <NavigationContainer theme={AppTheme}>
      {!isReady ? (
        <SplashScreen />
      ) : !session ? (
        <AuthNavigator />
      ) : isBranchPersonnel ? (
        <BranchStack />
      ) : (
        <ClientTabs />
      )}
    </NavigationContainer>
  );
};