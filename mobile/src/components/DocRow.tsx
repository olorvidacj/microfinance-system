import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { Badge } from './Badge';

export interface DocRowProps {
  name: string;
  type: string;
  submitted?: boolean;
  status?: string;
  onPress?: () => void;
  fileName?: string;
}

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  VALID_ID: 'card-outline',
  PROOF_OF_ADDRESS: 'location-outline',
  PROOF_OF_INCOME: 'cash-outline',
  PHOTO_2X2: 'person-circle-outline',
};

export const DocRow: React.FC<DocRowProps> = ({ name, type, submitted, status, onPress, fileName }) => {
  const icon = TYPE_ICONS[type] ?? 'document-text-outline';
  const isSubmitted = submitted || !!fileName;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
      <View style={[styles.iconWrap, isSubmitted ? styles.iconSubmitted : styles.iconMissing]}>
        <Ionicons
          name={icon}
          size={20}
          color={isSubmitted ? colors.greenDark : colors.textFaint}
        />
      </View>
      <View style={styles.details}>
        <Text style={styles.name} numberOfLines={2}>{name}</Text>
        <Text style={styles.type}>{type.replace(/_/g, ' ')}</Text>
        {fileName ? <Text style={styles.file} numberOfLines={1}>{fileName}</Text> : null}
      </View>
      {isSubmitted ? (
        status === 'VERIFIED' ? (
          <Badge status="VERIFIED" />
        ) : (
          <Badge status="PENDING" />
        )
      ) : (
        <View style={styles.uploadBadge}>
          <Ionicons name="cloud-upload-outline" size={14} color={colors.primaryBright} />
          <Text style={styles.uploadText}>Upload</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconSubmitted: {
    backgroundColor: colors.greenSoft,
  },
  iconMissing: {
    backgroundColor: colors.background,
  },
  details: {
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  type: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
    textTransform: 'capitalize',
  },
  file: {
    fontSize: 10,
    color: colors.info,
    fontWeight: '600',
    marginTop: 2,
  },
  uploadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.round,
  },
  uploadText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryBright,
    marginLeft: 4,
  },
});