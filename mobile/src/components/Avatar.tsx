import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { initials } from '../utils/format';

export interface AvatarProps {
  name?: string | null;
  uri?: string | null;
  size?: number;
  bg?: string;
  fg?: string;
}

const AVATAR_COLORS = ['#1E3A8A', '#0D9488', '#10B981', '#2563EB', '#0F766E', '#312E81'];

export const Avatar: React.FC<AvatarProps> = ({ name, uri, size = 44, bg, fg }) => {
  const fallbackBg = bg ?? AVATAR_COLORS[Math.abs((name || '').length) % AVATAR_COLORS.length];

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fallbackBg,
        },
      ]}
    >
      <Text style={[styles.initials, { color: fg ?? colors.white, fontSize: size * 0.4 }]}>
        {initials(name)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.background,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '800',
  },
});