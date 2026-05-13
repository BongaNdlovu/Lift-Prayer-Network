import React, { useState } from 'react';
import {
  Alert,
  Clipboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { fonts, radius, spacing } from '../theme/colors';
import { LiftScreen } from '../components/LiftLayout';

// Bank Details
const BANK_DETAILS = {
  bankName: 'Nedbank',
  accountType: 'Current Account',
  accountHolder: 'K R Conning',
  accountNumber: '1156271916',
  branchCode: '198765', // Standard Nedbank universal branch code
};

const DonationScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      if (Platform.OS !== 'web') {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch { /* ignore */ }
      }
      
      // Use the Clipboard API
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(text);
      } else {
        Clipboard.setString(text);
      }
      
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
      
      Alert.alert('Copied!', `${fieldName} copied to clipboard`);
    } catch (err) {
      console.warn('Could not copy to clipboard:', err);
    }
  };

  const copyAllDetails = () => {
    const allDetails = `Bank: ${BANK_DETAILS.bankName}
Account Type: ${BANK_DETAILS.accountType}
Account Holder: ${BANK_DETAILS.accountHolder}
Account Number: ${BANK_DETAILS.accountNumber}
Branch Code: ${BANK_DETAILS.branchCode}`;
    
    copyToClipboard(allDetails, 'All details');
  };

  return (
    <LiftScreen scroll>
      {/* === HEADER SECTION === */}
      <View style={styles.headerSection}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View>
          <Text style={[styles.kicker, { color: colors.muted }]}>GIVE BACK</Text>
          <Text style={[styles.heading, { color: colors.text }]}>
            Support<Text style={styles.headingDot}>.</Text>
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* === MAIN CONTENT === */}
      <View style={styles.mainContent}>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.heartContainer}>
              <Text style={styles.heartEmoji}>💝</Text>
            </View>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Help Keep Lift Running</Text>
            <Text style={[styles.heroSubtitle, { color: colors.muted }]}>
              Your donation helps us maintain and improve the app for our prayer community
            </Text>
          </View>

          {/* Why Donate Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Why Your Support Matters</Text>
            
            <View style={styles.reasonCard}>
              <View style={styles.reasonIcon}>
                <Ionicons name="server-outline" size={24} color={colors.accent} />
              </View>
              <View style={styles.reasonContent}>
                <Text style={[styles.reasonTitle, { color: colors.text }]}>Server & Infrastructure</Text>
                <Text style={[styles.reasonText, { color: colors.muted }]}>
                  Keeping our servers running 24/7 so you can always access your prayers and connect with others
                </Text>
              </View>
            </View>

            <View style={styles.reasonCard}>
              <View style={styles.reasonIcon}>
                <Ionicons name="construct-outline" size={24} color={colors.success} />
              </View>
              <View style={styles.reasonContent}>
                <Text style={[styles.reasonTitle, { color: colors.text }]}>App Development</Text>
                <Text style={[styles.reasonText, { color: colors.muted }]}>
                  Continuous improvements, new features, and bug fixes to make your experience better
                </Text>
              </View>
            </View>

            <View style={styles.reasonCard}>
              <View style={styles.reasonIcon}>
                <Ionicons name="shield-checkmark-outline" size={24} color={colors.accent} />
              </View>
              <View style={styles.reasonContent}>
                <Text style={[styles.reasonTitle, { color: colors.text }]}>Security & Privacy</Text>
                <Text style={[styles.reasonText, { color: colors.muted }]}>
                  Maintaining secure infrastructure to protect your personal data and prayer requests
                </Text>
              </View>
            </View>

            <View style={styles.reasonCard}>
              <View style={styles.reasonIcon}>
                <Ionicons name="people-outline" size={24} color={colors.accent} />
              </View>
              <View style={styles.reasonContent}>
                <Text style={[styles.reasonTitle, { color: colors.text }]}>Growing Community</Text>
                <Text style={[styles.reasonText, { color: colors.muted }]}>
                  Supporting more users as our prayer community grows and reaches more people
                </Text>
              </View>
            </View>
          </View>

          {/* How to Donate Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>How to Donate</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
              You can support us through EFT, bank deposit, or any other banking method
            </Text>

            {/* Bank Details Card */}
            <View style={styles.bankCard}>
              <View style={styles.bankHeader}>
                <View style={styles.bankLogoContainer}>
                  <Text style={styles.bankLogo}>🏦</Text>
                </View>
                <View>
                  <Text style={[styles.bankName, { color: colors.text }]}> {BANK_DETAILS.bankName}</Text>
                  <Text style={[styles.accountType, { color: colors.text }]}>{BANK_DETAILS.accountType}</Text>
                </View>
              </View>

              <View style={styles.bankDetails}>
                {/* Account Holder */}
                <TouchableOpacity 
                  style={styles.detailRow}
                  onPress={() => copyToClipboard(BANK_DETAILS.accountHolder, 'Account Holder')}
                >
                  <View style={styles.detailInfo}>
                    <Text style={[styles.detailLabel, { color: colors.muted }]}>Account Holder</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{BANK_DETAILS.accountHolder}</Text>
                  </View>
                  <View style={[styles.copyButton, copiedField === 'Account Holder' && styles.copyButtonCopied]}>
                    <Ionicons 
                      name={copiedField === 'Account Holder' ? 'checkmark' : 'copy-outline'} 
                      size={18} 
                      color={copiedField === 'Account Holder' ? colors.success : colors.muted} 
                    />
                  </View>
                </TouchableOpacity>

                {/* Account Number */}
                <TouchableOpacity 
                  style={styles.detailRow}
                  onPress={() => copyToClipboard(BANK_DETAILS.accountNumber, 'Account Number')}
                >
                  <View style={styles.detailInfo}>
                    <Text style={[styles.detailLabel, { color: colors.muted }]}>Account Number</Text>
                    <Text style={[styles.detailValueLarge, { color: colors.text }]}>{BANK_DETAILS.accountNumber}</Text>
                  </View>
                  <View style={[styles.copyButton, copiedField === 'Account Number' && styles.copyButtonCopied]}>
                    <Ionicons 
                      name={copiedField === 'Account Number' ? 'checkmark' : 'copy-outline'} 
                      size={18} 
                      color={copiedField === 'Account Number' ? colors.success : colors.muted} 
                    />
                  </View>
                </TouchableOpacity>

                {/* Branch Code */}
                <TouchableOpacity 
                  style={styles.detailRow}
                  onPress={() => copyToClipboard(BANK_DETAILS.branchCode, 'Branch Code')}
                >
                  <View style={styles.detailInfo}>
                    <Text style={[styles.detailLabel, { color: colors.muted }]}>Branch Code</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{BANK_DETAILS.branchCode}</Text>
                  </View>
                  <View style={[styles.copyButton, copiedField === 'Branch Code' && styles.copyButtonCopied]}>
                    <Ionicons 
                      name={copiedField === 'Branch Code' ? 'checkmark' : 'copy-outline'} 
                      size={18} 
                      color={copiedField === 'Branch Code' ? colors.success : colors.muted} 
                    />
                  </View>
                </TouchableOpacity>

                {/* Bank Name */}
                <TouchableOpacity 
                  style={[styles.detailRow, styles.detailRowLast]}
                  onPress={() => copyToClipboard(BANK_DETAILS.bankName, 'Bank Name')}
                >
                  <View style={styles.detailInfo}>
                    <Text style={[styles.detailLabel, { color: colors.muted }]}>Bank</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{BANK_DETAILS.bankName}</Text>
                  </View>
                  <View style={[styles.copyButton, copiedField === 'Bank Name' && styles.copyButtonCopied]}>
                    <Ionicons 
                      name={copiedField === 'Bank Name' ? 'checkmark' : 'copy-outline'} 
                      size={18} 
                      color={copiedField === 'Bank Name' ? colors.success : colors.muted} 
                    />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Copy All Button */}
              <TouchableOpacity style={styles.copyAllButton} onPress={copyAllDetails}>
                <Ionicons name="clipboard-outline" size={18} color={colors.text} />
                <Text style={[styles.copyAllText, { color: colors.text }]}>Copy All Details</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Payment Methods */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Accepted Payment Methods</Text>
            <View style={styles.methodsGrid}>
              <View style={styles.methodCard}>
                <Ionicons name="swap-horizontal" size={24} color={colors.accent} />
                <Text style={[styles.methodText, { color: colors.text }]}>EFT Transfer</Text>
              </View>
              <View style={styles.methodCard}>
                <Ionicons name="business" size={24} color={colors.success} />
                <Text style={[styles.methodText, { color: colors.text }]}>Bank Deposit</Text>
              </View>
              <View style={styles.methodCard}>
                <Ionicons name="phone-portrait" size={24} color={colors.accent} />
                <Text style={[styles.methodText, { color: colors.text }]}>Mobile Banking</Text>
              </View>
              <View style={styles.methodCard}>
                <Ionicons name="card" size={24} color={colors.accent} />
                <Text style={[styles.methodText, { color: colors.text }]}>Internet Banking</Text>
              </View>
            </View>
          </View>

          {/* Thank You Section */}
          <View style={styles.thankYouSection}>
            <Text style={styles.thankYouEmoji}>🙏</Text>
            <Text style={[styles.thankYouTitle, { color: colors.text }]}>Thank You</Text>
            <Text style={[styles.thankYouText, { color: colors.muted }]}>
              Every donation, no matter the size, helps keep this prayer community running. 
              We are deeply grateful for your support and generosity.
            </Text>
            <Text style={[styles.thankYouVerse, { color: colors.text }]}>
              &quot;Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.&quot;
            </Text>
            <Text style={[styles.verseReference, { color: colors.muted }]}>— 2 Corinthians 9:7</Text>
          </View>

          <View style={{ height: 140 }} />
        </ScrollView>
      </View>
    </LiftScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Header styles
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 20,
  },
  headerLeft: {
    width: 44,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    opacity: 0.8,
    textAlign: 'center',
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 32,
    fontWeight: '500',
    letterSpacing: -1.5,
    lineHeight: 34,
    textAlign: 'center',
  },
  headingDot: {
    color: '#4A5D4E',
  },
  
  // Content styles
  mainContent: {
    flex: 1,
    zIndex: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  heartContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    elevation: 8,
  },
  heartEmoji: {
    fontSize: 50,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  reasonCard: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    elevation: 2,
  },
  reasonIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  reasonContent: {
    flex: 1,
  },
  reasonTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bankCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    elevation: 4,
  },
  bankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: '#10b981',
  },
  bankLogoContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  bankLogo: {
    fontSize: 28,
  },
  bankName: {
    fontSize: 20,
    fontWeight: '800',
  },
  accountType: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  bankDetails: {
    padding: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailInfo: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  detailValueLarge: {
    fontSize: 22,
    fontWeight: '800',
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonCopied: {
    backgroundColor: '#34c759',
  },
  copyAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  copyAllText: {
    fontSize: 14,
    fontWeight: '700',
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  methodCard: {
    width: '48%',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    elevation: 2,
  },
  methodText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  thankYouSection: {
    backgroundColor: '#fef3c7',
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  thankYouEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  thankYouTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#92400e',
    marginBottom: spacing.sm,
  },
  thankYouText: {
    fontSize: 15,
    color: '#B8956B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  thankYouVerse: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#92400e',
    textAlign: 'center',
    lineHeight: 22,
  },
  verseReference: {
    fontSize: 12,
    color: '#B8956B',
    marginTop: spacing.xs,
    fontWeight: '600',
  },
});

export default DonationScreen;
