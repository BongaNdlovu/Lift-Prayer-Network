import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { palette, spacing, radius } from '../theme/colors';

const LAST_UPDATED = 'November 30, 2025';
const CONTACT_EMAIL = 'support@liftprayer.app';

export const PrivacyPolicyScreen: React.FC = () => {
  const navigation = useNavigation();

  const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const Paragraph: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Text style={styles.paragraph}>{children}</Text>
  );

  const BulletPoint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Last Updated: {LAST_UPDATED}</Text>

        <Paragraph>
          Lift ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application.
        </Paragraph>

        <Section title="1. Information We Collect">
          <Paragraph>We collect information you provide directly:</Paragraph>
          <BulletPoint>Account information (email, display name, profile photo)</BulletPoint>
          <BulletPoint>Prayer requests and testimonies you create</BulletPoint>
          <BulletPoint>Comments and reactions you make</BulletPoint>
          <BulletPoint>Groups you create or join</BulletPoint>
          
          <Paragraph>We automatically collect:</Paragraph>
          <BulletPoint>Device information (device type, operating system)</BulletPoint>
          <BulletPoint>Usage data (features used, interaction patterns)</BulletPoint>
          <BulletPoint>Crash reports and performance data</BulletPoint>
        </Section>

        <Section title="2. How We Use Your Information">
          <BulletPoint>To provide and maintain the Lift service</BulletPoint>
          <BulletPoint>To send push notifications about prayer activity</BulletPoint>
          <BulletPoint>To improve our app and user experience</BulletPoint>
          <BulletPoint>To detect and prevent abuse or violations</BulletPoint>
          <BulletPoint>To respond to your support requests</BulletPoint>
        </Section>

        <Section title="3. Information Sharing">
          <Paragraph>
            Your prayer requests and testimonies are shared with other users based on your privacy settings (Public, Private, or Group-only).
          </Paragraph>
          <Paragraph>
            We do not sell your personal information. We may share data with:
          </Paragraph>
          <BulletPoint>Firebase (Google) for authentication and data storage</BulletPoint>
          <BulletPoint>Expo for push notifications</BulletPoint>
          <BulletPoint>Analytics providers to improve our service</BulletPoint>
        </Section>

        <Section title="4. Data Security">
          <Paragraph>
            We implement appropriate security measures to protect your information, including encryption in transit and at rest. However, no method of transmission over the Internet is 100% secure.
          </Paragraph>
        </Section>

        <Section title="5. Your Rights">
          <Paragraph>You have the right to:</Paragraph>
          <BulletPoint>Access your personal data</BulletPoint>
          <BulletPoint>Delete your account and associated data</BulletPoint>
          <BulletPoint>Update or correct your information</BulletPoint>
          <BulletPoint>Opt out of push notifications</BulletPoint>
          <BulletPoint>Block other users</BulletPoint>
        </Section>

        <Section title="6. Data Retention">
          <Paragraph>
            We retain your data for as long as your account is active. When you delete your account, we will delete your personal information within 30 days, except where required by law.
          </Paragraph>
        </Section>

        <Section title="7. Children's Privacy">
          <Paragraph>
            Lift is not intended for children under 13. We do not knowingly collect information from children under 13. If you believe we have collected such information, please contact us.
          </Paragraph>
        </Section>

        <Section title="8. Changes to This Policy">
          <Paragraph>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy in the app and updating the "Last Updated" date.
          </Paragraph>
        </Section>

        <Section title="9. Contact Us">
          <Paragraph>
            If you have questions about this Privacy Policy, please contact us at:
          </Paragraph>
          <TouchableOpacity onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
            <Text style={styles.link}>{CONTACT_EMAIL}</Text>
          </TouchableOpacity>
        </Section>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  lastUpdated: {
    fontSize: 12,
    color: palette.muted,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
    marginBottom: spacing.sm,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
    marginBottom: spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
    paddingLeft: spacing.sm,
  },
  bullet: {
    fontSize: 14,
    color: palette.accent,
    marginRight: spacing.sm,
    fontWeight: '700',
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  link: {
    fontSize: 14,
    color: palette.accentDark,
    textDecorationLine: 'underline',
  },
  bottomPadding: {
    height: 40,
  },
});

export default PrivacyPolicyScreen;
