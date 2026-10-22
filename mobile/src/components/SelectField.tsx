import React, { useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../theme';
import { SearchBar } from './SearchBar';

export interface SelectOption {
  code: string;
  name: string;
}

/** A field that opens a searchable list (PSGC regions, cities, barangays...). */
export const SelectField: React.FC<{
  label: string;
  value: string;
  options: SelectOption[];
  onSelect: (option: SelectOption) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  loading?: boolean;
}> = ({ label, value, options, onSelect, placeholder = 'Choose…', error, disabled, loading }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.field, error ? styles.fieldError : null, disabled ? styles.fieldDisabled : null]}
        onPress={() => { setQuery(''); setOpen(true); }}
        disabled={disabled || loading}
        accessibilityLabel={label}
      >
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {loading ? 'Loading…' : value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textFaint} />
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{label}</Text>
            <TouchableOpacity onPress={() => setOpen(false)} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.search}>
            <SearchBar value={query} onChangeText={setQuery} placeholder={`Search ${label.toLowerCase()}`} />
          </View>
          <FlatList
            data={shown}
            keyExtractor={(o) => o.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.option} onPress={() => { onSelect(item); setOpen(false); }}>
                <Text style={styles.optionText}>{item.name}</Text>
                {item.name === value ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Nothing matches “{query}”.</Text>}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.surface },
  fieldError: { borderColor: colors.danger },
  fieldDisabled: { opacity: 0.5 },
  value: { flex: 1, fontSize: 14, color: colors.text },
  placeholder: { color: colors.textFaint },
  error: { fontSize: 11, color: colors.danger, marginTop: 4 },
  sheet: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  search: { paddingHorizontal: 16, paddingBottom: 8 },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  optionText: { fontSize: 14, color: colors.text, flex: 1 },
  empty: { textAlign: 'center', color: colors.textMuted, padding: 24 },
});
