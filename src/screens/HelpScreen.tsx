import React, { useState } from 'react';
import {
  Animated,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { palette, radius, spacing } from '../theme/colors';

const SUPPORT_EMAIL = 'fanelesibonge50@gmail.com';

type HelpSection = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  content: HelpItem[];
};

type HelpItem = {
  title: string;
  description: string;
  tip?: string;
};

const helpSections: HelpSection[] = [
  {
    id: 'getting-started',
    icon: 'rocket-outline',
    iconColor: '#f59e0b',
    iconBg: '#fef3c7',
    title: 'Getting Started',
    content: [
      {
        title: 'Welcome to Lift! ✝️',
        description: 'Lift is a prayer community app where you can share prayer requests, lift others up in prayer, and celebrate answered prayers together.',
        tip: 'Your prayers matter! Every prayer you make helps strengthen our community of faith.',
      },
      {
        title: 'Creating Your Profile',
        description: 'Tap on the Profile tab to set up your profile. You can add a display name, profile picture, and customize your notification settings.',
        tip: 'Tap your profile photo to change it, or long-press to remove it.',
      },
      {
        title: 'Navigation',
        description: 'Use the bottom tabs to navigate: Feed (prayer requests), Groups (prayer communities), Calendar (prayer schedule), Stats (your impact), and Profile (your account).',
      },
    ],
  },
  {
    id: 'prayer-requests',
    icon: 'radio-outline',
    iconColor: '#3b82f6',
    iconBg: '#dbeafe',
    title: 'Prayer Requests',
    content: [
      {
        title: 'Creating a Prayer Request',
        description: 'Tap the "+" button on the Feed screen to create a new prayer request. Share what\'s on your heart and let others know how they can pray for you.',
        tip: 'Be specific about your needs - it helps others pray more effectively for you.',
      },
      {
        title: 'Praying for Others',
        description: 'When you see a prayer request, tap the "Pray" button to let the person know you\'re lifting them up. This sends encouragement and builds community.',
        tip: 'Take a moment to actually pray before tapping - your prayers make a difference!',
      },
      {
        title: 'Prayer Categories',
        description: 'Requests can be categorized (Health, Family, Work, etc.) to help you find and pray for specific needs. Use filters to focus on areas close to your heart.',
      },
      {
        title: 'Critical Requests',
        description: 'Mark urgent needs as "Critical" to notify users who have critical alerts enabled. Use this sparingly for truly urgent situations.',
        tip: 'Only mark requests as critical for truly urgent situations like medical emergencies or immediate needs.',
      },
    ],
  },
  {
    id: 'testimonies',
    icon: 'sparkles-outline',
    iconColor: '#22c55e',
    iconBg: '#dcfce7',
    title: 'Testimonies',
    content: [
      {
        title: 'Sharing Answered Prayers',
        description: 'When your prayer is answered, share a testimony! Tap "Create Testimony" to celebrate God\'s faithfulness and encourage others.',
        tip: 'Testimonies inspire faith in others - don\'t be shy about sharing your victories!',
      },
      {
        title: 'Celebrating Together',
        description: 'When you see a testimony, celebrate with the person by tapping the celebration button. Shared joy multiplies!',
      },
      {
        title: 'Marking Requests as Answered',
        description: 'You can mark your prayer requests as "Answered" which moves them to testimonies and notifies those who prayed.',
      },
    ],
  },
  {
    id: 'groups',
    icon: 'people-circle-outline',
    iconColor: '#8b5cf6',
    iconBg: '#ede9fe',
    title: 'Prayer Groups',
    content: [
      {
        title: 'Joining Groups',
        description: 'Go to the Groups tab to browse and join prayer communities. Groups can be for your church, small group, family, or any community.',
        tip: 'Groups are a great way to pray together with people you know personally.',
      },
      {
        title: 'Creating Groups',
        description: 'Tap "Create Group" to start your own prayer community. You can make it public (anyone can join) or private (invite only).',
      },
      {
        title: 'Group Requests',
        description: 'When creating a prayer request, you can choose to share it with specific groups instead of the public feed for more intimate prayer support.',
      },
    ],
  },
  {
    id: 'calendar',
    icon: 'calendar-outline',
    iconColor: '#ec4899',
    iconBg: '#fce7f3',
    title: 'Calendar & Reminders',
    content: [
      {
        title: 'Prayer Calendar',
        description: 'The Calendar tab shows your prayer activity over time. See which days you\'ve prayed and track your prayer habits.',
      },
      {
        title: 'Setting Reminders',
        description: 'Go to Profile → Prayer Reminders to set daily prayer notifications. Choose the time that works best for your schedule.',
        tip: 'Consistent prayer time helps build a lasting habit.',
      },
      {
        title: 'Streak Tracking',
        description: 'Your prayer streak shows how many consecutive days you\'ve prayed. Build your streak to earn achievements!',
      },
    ],
  },
  {
    id: 'stats',
    icon: 'stats-chart-outline',
    iconColor: '#06b6d4',
    iconBg: '#cffafe',
    title: 'Stats & Achievements',
    content: [
      {
        title: 'Your Impact',
        description: 'The Stats tab shows your prayer activity: how many prayers you\'ve made, testimonies shared, and people you\'ve lifted up.',
      },
      {
        title: 'Achievements',
        description: 'Earn badges for reaching milestones like praying consistently, helping others, and sharing testimonies. Go to Profile → Achievements to see all available badges.',
        tip: 'Achievements aren\'t about competition - they\'re encouragement to keep growing in faith!',
      },
      {
        title: 'People I Prayed For',
        description: 'Track everyone you\'ve prayed for in one place. Go to Profile → People I Prayed For to see your prayer connections.',
      },
    ],
  },
  {
    id: 'notifications',
    icon: 'notifications-outline',
    iconColor: '#f97316',
    iconBg: '#ffedd5',
    title: 'Notifications',
    content: [
      {
        title: 'Notification Settings',
        description: 'Customize which notifications you receive in Profile → Notification Settings. Choose what matters most to you.',
      },
      {
        title: 'Critical Alerts',
        description: 'Enable critical alerts to be notified of urgent prayer requests. Toggle this in your Profile under "Critical alerts".',
        tip: 'Even with notifications off, you can always check the app for updates.',
      },
      {
        title: 'Prayer Updates',
        description: 'Get notified when someone prays for your request, when requests are answered, and when groups have new activity.',
      },
    ],
  },
  {
    id: 'devotions',
    icon: 'book-outline',
    iconColor: '#8b5cf6',
    iconBg: '#ede9fe',
    title: 'Daily Devotions',
    content: [
      {
        title: 'Reading Devotions',
        description: 'Tap "Daily Devotion" at the top of the Feed to access daily devotional content. Each devotion includes a Bible verse, message, reflection, and prayer.',
        tip: 'Start your day with the daily devotion to center your heart before praying for others.',
      },
      {
        title: 'Devotion Content',
        description: 'Each devotion features a Scripture passage, a thoughtful message, reflection questions to ponder, and a closing prayer.',
      },
      {
        title: 'Previous Devotions',
        description: 'Scroll down on the Devotions page to browse previous devotions. Great for catching up or revisiting meaningful messages.',
      },
    ],
  },
  {
    id: 'announcements',
    icon: 'megaphone-outline',
    iconColor: '#dc2626',
    iconBg: '#fef2f2',
    title: 'Announcements',
    content: [
      {
        title: 'Viewing Announcements',
        description: 'Tap "Announcements" at the top of the Feed to see important updates from the app administrators.',
      },
      {
        title: 'Priority Levels',
        description: 'Announcements are color-coded by priority: Normal (blue), Important (orange), and Urgent (red). Pay attention to urgent announcements!',
      },
      {
        title: 'Staying Informed',
        description: 'Check announcements regularly for community updates, new features, events, and important notices.',
        tip: 'Announcements are managed by app administrators to keep the community informed.',
      },
    ],
  },
  {
    id: 'privacy',
    icon: 'shield-checkmark-outline',
    iconColor: '#64748b',
    iconBg: '#f1f5f9',
    title: 'Privacy & Settings',
    content: [
      {
        title: 'Your Privacy',
        description: 'Go to Profile → Settings & Privacy to manage your account, blocked users, and data preferences.',
      },
      {
        title: 'Anonymous Requests',
        description: 'When creating requests, toggle "Post Anonymously" if you\'re not comfortable sharing your identity. Your name won\'t be shown to others.',
        tip: 'Great for sensitive prayer needs where you want privacy.',
      },
      {
        title: 'Blocking Users',
        description: 'If someone is bothering you, you can block them from Settings. Blocked users can\'t see your requests or interact with you.',
      },
      {
        title: 'Email Verification',
        description: 'Verify your email to get a verified badge on your profile. This helps build trust in the community and unlocks all posting features.',
        tip: 'Check your inbox for a verification email after signing up.',
      },
      {
        title: 'Data & Account',
        description: 'You can delete your prayer history, delete your account, or manage blocked users from Settings. We respect your privacy and your right to your information.',
      },
    ],
  },
  {
    id: 'community',
    icon: 'heart-outline',
    iconColor: '#ec4899',
    iconBg: '#fce7f3',
    title: 'Community Guidelines',
    content: [
      {
        title: 'Be Respectful',
        description: 'Treat everyone with kindness and respect. This is a faith community built on love and support.',
        tip: 'If you see inappropriate content, use the Report option to notify moderators.',
      },
      {
        title: 'Authentic Requests',
        description: 'Share genuine prayer needs. Avoid spam, solicitation, or content that doesn\'t align with the app\'s purpose.',
      },
      {
        title: 'Moderation',
        description: 'Our moderators help keep the community safe. They can remove inappropriate content and restrict users who violate guidelines.',
      },
      {
        title: 'Reporting Issues',
        description: 'If you see something concerning, tap the three dots on any post and select "Report". Our team will review it promptly.',
      },
    ],
  },
];

const CollapsibleSection: React.FC<{
  section: HelpSection;
  isExpanded: boolean;
  onToggle: () => void;
  colors: any;
}> = ({ section, isExpanded, onToggle, colors }) => {
  const rotateAnim = React.useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={[styles.sectionIcon, { backgroundColor: section.iconBg }]}>
          <Ionicons name={section.icon} size={22} color={section.iconColor} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Ionicons name="chevron-down" size={20} color={colors.muted} />
        </Animated.View>
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.sectionContent}>
          {section.content.map((item, index) => (
            <View key={index} style={styles.helpItem}>
              <Text style={[styles.helpItemTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.helpItemDescription, { color: colors.muted }]}>{item.description}</Text>
              {item.tip && (
                <View style={styles.tipContainer}>
                  <Ionicons name="bulb-outline" size={16} color={colors.accent} />
                  <Text style={styles.tipText}>{item.tip}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export const HelpScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const handleContactSupport = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const subject = encodeURIComponent('Lift App Support Request');
    const body = encodeURIComponent(
      `Hi Lift Support Team,\n\nI need help with:\n\n[Please describe your issue here]\n\n---\nApp: Lift Prayer Community\nPlatform: ${Platform.OS}`
    );
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        // Fallback: show email address to copy
        Alert.alert(
          'Contact Support',
          `Please email us at:\n\n${SUPPORT_EMAIL}\n\nWe typically respond within 24-48 hours.`,
          [
            { text: 'OK' },
            { 
              text: 'Copy Email', 
              onPress: () => {
                // Note: In a full implementation, you'd use Clipboard API here
                Alert.alert('Email Address', SUPPORT_EMAIL);
              }
            },
          ]
        );
      }
    } catch {
      Alert.alert(
        'Contact Support',
        `Please email us at:\n\n${SUPPORT_EMAIL}`,
        [{ text: 'OK' }]
      );
    }
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const expandAll = () => {
    setExpandedSections(helpSections.map((s) => s.id));
  };

  const collapseAll = () => {
    setExpandedSections([]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Help & Tutorial</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Banner */}
        <View style={styles.welcomeBanner}>
          <View style={styles.welcomeEmoji}>
            <Text style={styles.emojiText}>✝️</Text>
          </View>
          <Text style={styles.welcomeTitle}>How can we help?</Text>
          <Text style={styles.welcomeSubtitle}>
            Learn how to use Lift and make the most of your prayer community experience.
          </Text>
        </View>

        {/* Expand/Collapse All */}
        <View style={styles.expandControls}>
          <TouchableOpacity style={styles.expandButton} onPress={expandAll}>
            <Ionicons name="expand-outline" size={16} color={colors.accent} />
            <Text style={styles.expandButtonText}>Expand All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.expandButton} onPress={collapseAll}>
            <Ionicons name="contract-outline" size={16} color={colors.accent} />
            <Text style={styles.expandButtonText}>Collapse All</Text>
          </TouchableOpacity>
        </View>

        {/* Help Sections */}
        {helpSections.map((section) => (
          <CollapsibleSection
            key={section.id}
            section={section}
            isExpanded={expandedSections.includes(section.id)}
            onToggle={() => toggleSection(section.id)}
            colors={colors}
          />
        ))}

        {/* Quick Tips */}
        <View style={styles.quickTipsCard}>
          <View style={styles.quickTipsHeader}>
            <Ionicons name="flash" size={20} color={colors.accent} />
            <Text style={styles.quickTipsTitle}>Quick Tips</Text>
          </View>
          <View style={styles.quickTipsList}>
            <View style={styles.quickTip}>
              <Text style={styles.quickTipBullet}>•</Text>
              <Text style={styles.quickTipText}>Long press the Pray button to see more reactions</Text>
            </View>
            <View style={styles.quickTip}>
              <Text style={styles.quickTipBullet}>•</Text>
              <Text style={styles.quickTipText}>Pull down to refresh your feed</Text>
            </View>
            <View style={styles.quickTip}>
              <Text style={styles.quickTipBullet}>•</Text>
              <Text style={styles.quickTipText}>Tap a request to see full details and comments</Text>
            </View>
            <View style={styles.quickTip}>
              <Text style={styles.quickTipBullet}>•</Text>
              <Text style={styles.quickTipText}>Use category filters to find specific prayer needs</Text>
            </View>
            <View style={styles.quickTip}>
              <Text style={styles.quickTipBullet}>•</Text>
              <Text style={styles.quickTipText}>Check the Stats tab to see your prayer impact</Text>
            </View>
            <View style={styles.quickTip}>
              <Text style={styles.quickTipBullet}>•</Text>
              <Text style={styles.quickTipText}>Verify your email to unlock all features</Text>
            </View>
          </View>
        </View>

        {/* Coming Soon */}
        <View style={styles.comingSoonCard}>
          <View style={styles.comingSoonHeader}>
            <Ionicons name="rocket-outline" size={20} color={colors.accent} />
            <Text style={[styles.comingSoonTitle, { color: colors.accentDark }]}>Coming Soon</Text>
          </View>
          <View style={styles.comingSoonList}>
            <View style={styles.comingSoonItem}>
              <Text style={styles.comingSoonBullet}>🚀</Text>
              <Text style={[styles.comingSoonText, { color: colors.accent }]}>Swipe gestures for quick actions</Text>
            </View>
            <View style={styles.comingSoonItem}>
              <Text style={styles.comingSoonBullet}>📤</Text>
              <Text style={[styles.comingSoonText, { color: colors.accent }]}>Export your prayer data</Text>
            </View>
            <View style={styles.comingSoonItem}>
              <Text style={styles.comingSoonBullet}>🔔</Text>
              <Text style={[styles.comingSoonText, { color: colors.accent }]}>Enhanced push notification controls</Text>
            </View>
          </View>
        </View>

        {/* Contact Support */}
        <View style={styles.contactCard}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.muted} />
          <Text style={[styles.contactTitle, { color: colors.text }]}>Still need help?</Text>
          <Text style={[styles.contactText, { color: colors.muted }]}>
            If you have questions or feedback, we&apos;d love to hear from you. Reach out to our support team.
          </Text>
          <TouchableOpacity style={styles.contactButton} onPress={handleContactSupport}>
            <Ionicons name="mail-outline" size={18} color={colors.text} />
            <Text style={[styles.contactButtonText, { color: colors.text }]}>Contact Support</Text>
          </TouchableOpacity>
          <Text style={[styles.supportEmail, { color: colors.muted }]}>{SUPPORT_EMAIL}</Text>
        </View>

        <View style={{ height: 40 }} />
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  welcomeBanner: {
    backgroundColor: palette.accentLight,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  welcomeEmoji: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emojiText: {
    fontSize: 40,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: palette.accentDark,
    marginBottom: spacing.xs,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: palette.accent,
    textAlign: 'center',
    lineHeight: 20,
  },
  expandControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: palette.accentLight,
    borderRadius: radius.md,
  },
  expandButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.accentDark,
  },
  section: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  sectionContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: spacing.md,
  },
  helpItem: {
    marginBottom: spacing.md,
  },
  helpItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
    marginBottom: spacing.xs,
  },
  helpItemDescription: {
    fontSize: 14,
    color: palette.muted,
    lineHeight: 20,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: palette.accentLight,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: palette.accentDark,
    lineHeight: 18,
  },
  quickTipsCard: {
    backgroundColor: palette.accentLight,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.accent,
    marginBottom: spacing.lg,
  },
  quickTipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickTipsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.accentDark,
  },
  quickTipsList: {
    gap: spacing.sm,
  },
  quickTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  quickTipBullet: {
    fontSize: 14,
    color: palette.accent,
    marginRight: spacing.sm,
    fontWeight: '700',
  },
  quickTipText: {
    flex: 1,
    fontSize: 14,
    color: palette.accent,
    lineHeight: 20,
  },
  contactCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  contactText: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  supportEmail: {
    fontSize: 12,
    color: palette.muted,
    marginTop: spacing.sm,
  },
  comingSoonCard: {
    backgroundColor: palette.accentLight,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.accent,
    marginBottom: spacing.lg,
  },
  comingSoonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  comingSoonTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.accentDark,
  },
  comingSoonList: {
    gap: spacing.sm,
  },
  comingSoonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  comingSoonBullet: {
    fontSize: 14,
    marginRight: spacing.sm,
  },
  comingSoonText: {
    flex: 1,
    fontSize: 14,
    color: palette.accent,
    lineHeight: 20,
  },
});

