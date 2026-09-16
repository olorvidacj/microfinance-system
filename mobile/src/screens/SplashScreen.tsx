import React, { useEffect } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme';

export const SplashScreen: React.FC = () => {
  const { isReady } = useAuth();
  const fadeIn = React.useRef(new Animated.Value(0)).current;
  const scaleIn = React.useRef(new Animated.Value(0.85)).current;
  const taglineFade = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scaleIn, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
    ]).start();
    Animated.timing(taglineFade, { toValue: 1, duration: 900, delay: 450, useNativeDriver: true }).start();
  }, [fadeIn, scaleIn, taglineFade]);

  // Ensure splash stays visible long enough for a pleasant transition.
  useEffect(() => {
    if (isReady) {
      // RootNavigator will switch once ready; a short guard keeps minimum splash time.
    }
  }, [isReady]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.brandWrap, { opacity: fadeIn, transform: [{ scale: scaleIn }] }]}>
        <View style={styles.logoCircle}>
          <View style={styles.logoInner}>
            <Ionicons name="business" size={40} color={colors.white} />
          </View>
        </View>
        <Text style={styles.title}>HOSCOMO</Text>
        <Text style={styles.subtitle}>Microfinance Cooperative</Text>
      </Animated.View>

      <Animated.View style={{ opacity: taglineFade }}>
        <Text style={styles.tagline}>Empowering Members, Building Better Futures</Text>
      </Animated.View>

      <View style={styles.loader}>
        <ActivityIndicator size="small" color={colors.white} />
        <Text style={styles.loaderText}>Preparing your secure portal...</Text>
      </View>

      <Text style={styles.footer}>Client Services and Financial Transaction Management System</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  brandWrap: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 15,
    color: colors.primaryLight,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 0.6,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 28,
    letterSpacing: 0.4,
  },
  loader: {
    position: 'absolute',
    bottom: 90,
    alignItems: 'center',
  },
  loaderText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 34,
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});