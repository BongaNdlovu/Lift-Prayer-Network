import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { palette, spacing } from '../theme/colors';

const LAST_UPDATED = 'November 30, 2025';
const CONTACT_EMAIL = 'support@liftprayer.app';

export const TermsOfServiceScreen: React.FC = () => {
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
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Last Updated: {LAST_UPDATED}</Text>

        <Paragraph>
          Welcome to Lift! By using our app, you agree to these Terms of Service. Please read them carefully.
        </Paragraph>

        <Section title="1. Acceptance of Terms">
          <Paragraph>
            By accessing or using Lift, you agree to be bound by these Terms. If you do not agree, please do not use the app.
          </Paragraph>
        </Section>

        <Section title="2. Description of Service">
          <Paragraph>
            Lift is a prayer community app that allows users to share prayer requests, post testimonies, support others through prayer, and connect with fellow believers.
          </Paragraph>
        </Section>

        <Section title="3. User Accounts">
          <Paragraph>To use Lift, you must:</Paragraph>
          <BulletPoint>Be at least 13 years old</BulletPoint>
          <BulletPoint>Provide accurate account information</BulletPoint>
          <BulletPoint>Keep your login credentials secure</BulletPoint>
          <BulletPoint>Notify us of any unauthorized access</BulletPoint>
        </Section>

        <Section title="4. User Content">
          <Paragraph>
            You retain ownership of content you post. By posting, you grant Lift a license to display your content to other users based on your privacy settings.
          </Paragraph>
          <Paragraph>You agree not to post content that:</Paragraph>
          <BulletPoint>Is false, misleading, or deceptive</BulletPoint>
          <BulletPoint>Is hateful, threatening, or harassing</BulletPoint>
          <BulletPoint>Violates any law or regulation</BulletPoint>
          <BulletPoint>Infringes on intellectual property rights</BulletPoint>
          <BulletPoint>Contains spam or unauthorized advertising</BulletPoint>
          <BulletPoint>Is sexually explicit or violent</BulletPoint>
        </Section>

        <Section title="5. Community Guidelines">
          <Paragraph>Lift is a faith-based community. We expect users to:</Paragraph>
          <BulletPoint>Treat others with respect and compassion</BulletPoint>
          <BulletPoint>Support fellow users in their spiritual journey</BulletPoint>
          <BulletPoint>Report inappropriate content or behavior</BulletPoint>
          <BulletPoint>Respect the privacy of others</BulletPoint>
        </Section>

        <Section title="6. Moderation">
          <Paragraph>
            We reserve the right to remove content and suspend or terminate accounts that violate these Terms or our Community Guidelines, at our sole discretion.
          </Paragraph>
        </Section>

        <Section title="7. Intellectual Property">
          <Paragraph>
            The Lift app, including its design, features, and content (excluding user-generated content), is owned by us and protected by intellectual property laws.
          </Paragraph>
        </Section>

        <Section title="8. Disclaimer of Warranties">
          <Paragraph>
            Lift is provided &quot;as is&quot; without warranties of any kind. We do not guarantee uninterrupted or error-free service. We are not responsible for the accuracy of user-generated content.
          </Paragraph>
        </Section>

        <Section title="9. Limitation of Liability">
          <Paragraph>
            To the maximum extent permitted by law, Lift shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the app.
          </Paragraph>
        </Section>

        <Section title="10. Changes to Terms">
          <Paragraph>
            We may modify these Terms at any time. Continued use of Lift after changes constitutes acceptance of the new Terms.
          </Paragraph>
        </Section>

        <Section title="11. Termination">
          <Paragraph>
            You may delete your account at any time. We may suspend or terminate your access for violations of these Terms.
          </Paragraph>
        </Section>

        <Section title="12. Governing Law">
          <Paragraph>
            These Terms are governed by applicable law. Any disputes shall be resolved through appropriate legal channels.
          </Paragraph>
        </Section>

        <Section title="13. Contact">
          <Paragraph>
            For questions about these Terms, contact us at:
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

export default TermsOfServiceScreen;
