import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LiftScreen } from '../components/LiftLayout';
import { GlassCard } from '../components/GlassCard';
import { useTheme } from '../contexts/ThemeContext';
import { spacing } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';

export const CreateHubScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <LiftScreen contentStyle={styles.screenContent}>
      <View style={styles.headerSection}>
        <Text style={[styles.kicker, { color: colors.muted }]}>ADD</Text>
        <Text style={[styles.heading, { color: colors.text }]}>What would you like to share?</Text>
      </View>

      <View style={styles.content}>
        <GlassCard onPress={() => navigation.navigate('CreateRequest')} padding="lg" rounded="xl" style={styles.card}>
          <Ionicons name="heart-outline" size={32} color={colors.accentDark} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Ask for Prayer</Text>
          <Text style={[styles.cardText, { color: colors.muted }]}>Share a request with the community.</Text>
        </GlassCard>

        <GlassCard onPress={() => navigation.navigate('CreateTestimony')} padding="lg" rounded="xl" style={styles.card}>
          <Ionicons name="sparkles-outline" size={32} color={colors.accentDark} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Share Testimony</Text>
          <Text style={[styles.cardText, { color: colors.muted }]}>Celebrate an answered prayer.</Text>
        </GlassCard>
      </View>
    </LiftScreen>
  );
};

const styles = StyleSheet.create({
  screenContent: { paddingTop: 40 },
  headerSection: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.xs },
  heading: { fontSize: 30, fontWeight: '700', letterSpacing: -0.8 },
  content: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.sm },
  cardTitle: { fontSize: 22, fontWeight: '800' },
  cardText: { fontSize: 15, lineHeight: 22 },
});
