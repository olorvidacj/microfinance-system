import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';

export interface WizardStep {
  title: string;
  subtitle?: string;
}

export interface WizardHeaderProps {
  steps: WizardStep[];
  current: number; // 0-based
}

export const WizardHeader: React.FC<WizardHeaderProps> = ({ steps, current }) => {
  const progress = ((current + 1) / steps.length) * 100;
  const step = steps[current];

  return (
    <View style={styles.wrap}>
      <View style={styles.circles}>
        {steps.map((_, idx) => {
          const done = idx < current;
          const active = idx === current;
          return (
            <View key={idx} style={styles.circleSlot}>
              <View
                style={[
                  styles.circle,
                  done && styles.circleDone,
                  active && styles.circleActive,
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={13} color={colors.white} />
                ) : (
                  <Text style={[styles.circleText, active && styles.circleTextActive]}>
                    {idx + 1}
                  </Text>
                )}
              </View>
              {idx < steps.length - 1 ? (
                <View
                  style={[
                    styles.connector,
                    idx < current ? styles.connectorDone : styles.connectorPending,
                  ]}
                />
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={[styles.progressTrack]}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <Text style={styles.stepTitle}>
        Step {current + 1} of {steps.length}: {step.title}
      </Text>
      {step.subtitle ? <Text style={styles.stepSub}>{step.subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  circles: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  circleSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  circleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  circleText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  circleTextActive: {
    color: colors.white,
  },
  connector: {
    flex: 1,
    height: 2,
    marginHorizontal: 6,
    borderRadius: 1,
  },
  connectorDone: {
    backgroundColor: colors.green,
  },
  connectorPending: {
    backgroundColor: colors.border,
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.background,
    borderRadius: radius.round,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.primaryBright,
    borderRadius: radius.round,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  stepSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});