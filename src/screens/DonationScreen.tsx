import React, { useState } from 'react';
import {
  Alert,
  Clipboard,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { palette, radius, spacing, fonts } from '../theme/colors';

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
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      if (Platform.OS !== 'web') {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) {}
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
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#fefce8', '#f5f3ff', '#fef3c7']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Support Lift</Text>
          <View style={{ width: 40 }} />
        </View>

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
            <Text style={styles.heroTitle}>Help Keep Lift Running</Text>
            <Text style={styles.heroSubtitle}>
              Your donation helps us maintain and improve the app for our prayer community
            </Text>
          </View>

          {/* Why Donate Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Why Your Support Matters</Text>
            
            <View style={styles.reasonCard}>
              <View style={styles.reasonIcon}>
                <Ionicons name="server-outline" size={24} color="#3b82f6" />
              </View>
              <View style={styles.reasonContent}>
                <Text style={styles.reasonTitle}>Server & Infrastructure</Text>
                <Text style={styles.reasonText}>
                  Keeping our servers running 24/7 so you can always access your prayers and connect with others
                </Text>
              </View>
            </View>

            <View style={styles.reasonCard}>
              <View style={styles.reasonIcon}>
                <Ionicons name="construct-outline" size={24} color="#22c55e" />
              </View>
              <View style={styles.reasonContent}>
                <Text style={styles.reasonTitle}>App Development</Text>
                <Text style={styles.reasonText}>
                  Continuous improvements, new features, and bug fixes to make your experience better
                </Text>
              </View>
            </View>

            <View style={styles.reasonCard}>
              <View style={styles.reasonIcon}>
                <Ionicons name="shield-checkmark-outline" size={24} color="#8b5cf6" />
              </View>
              <View style={styles.reasonContent}>
                <Text style={styles.reasonTitle}>Security & Privacy</Text>
                <Text style={styles.reasonText}>
                  Maintaining secure infrastructure to protect your personal data and prayer requests
                </Text>
              </View>
            </View>

            <View style={styles.reasonCard}>
              <View style={styles.reasonIcon}>
                <Ionicons name="people-outline" size={24} color="#f59e0b" />
              </View>
              <View style={styles.reasonContent}>
                <Text style={styles.reasonTitle}>Growing Community</Text>
                <Text style={styles.reasonText}>
                  Supporting more users as our prayer community grows and reaches more people
                </Text>
              </View>
            </View>
          </View>

          {/* How to Donate Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How to Donate</Text>
            <Text style={styles.sectionSubtitle}>
              You can support us through EFT, bank deposit, or any other banking method
            </Text>

            {/* Bank Details Card */}
            <View style={styles.bankCard}>
              <View style={styles.bankHeader}>
                <View style={styles.bankLogoContainer}>
                  <Text style={styles.bankLogo}>🏦</Text>
                </View>
                <View>
                  <Text style={styles.bankName}>{BANK_DETAILS.bankName}</Text>
                  <Text style={styles.accountType}>{BANK_DETAILS.accountType}</Text>
                </View>
              </View>

              <View style={styles.bankDetails}>
                {/* Account Holder */}
                <TouchableOpacity 
                  style={styles.detailRow}
                  onPress={() => copyToClipboard(BANK_DETAILS.accountHolder, 'Account Holder')}
                >
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>Account Holder</Text>
                    <Text style={styles.detailValue}>{BANK_DETAILS.accountHolder}</Text>
                  </View>
                  <View style={[styles.copyButton, copiedField === 'Account Holder' && styles.copyButtonCopied]}>
                    <Ionicons 
                      name={copiedField === 'Account Holder' ? 'checkmark' : 'copy-outline'} 
                      size={18} 
                      color={copiedField === 'Account Holder' ? '#22c55e' : palette.muted} 
                    />
                  </View>
                </TouchableOpacity>

                {/* Account Number */}
                <TouchableOpacity 
                  style={styles.detailRow}
                  onPress={() => copyToClipboard(BANK_DETAILS.accountNumber, 'Account Number')}
                >
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>Account Number</Text>
                    <Text style={styles.detailValueLarge}>{BANK_DETAILS.accountNumber}</Text>
                  </View>
                  <View style={[styles.copyButton, copiedField === 'Account Number' && styles.copyButtonCopied]}>
                    <Ionicons 
                      name={copiedField === 'Account Number' ? 'checkmark' : 'copy-outline'} 
                      size={18} 
                      color={copiedField === 'Account Number' ? '#22c55e' : palette.muted} 
                    />
                  </View>
                </TouchableOpacity>

                {/* Branch Code */}
                <TouchableOpacity 
                  style={styles.detailRow}
                  onPress={() => copyToClipboard(BANK_DETAILS.branchCode, 'Branch Code')}
                >
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>Branch Code</Text>
                    <Text style={styles.detailValue}>{BANK_DETAILS.branchCode}</Text>
                  </View>
                  <View style={[styles.copyButton, copiedField === 'Branch Code' && styles.copyButtonCopied]}>
                    <Ionicons 
                      name={copiedField === 'Branch Code' ? 'checkmark' : 'copy-outline'} 
                      size={18} 
                      color={copiedField === 'Branch Code' ? '#22c55e' : palette.muted} 
                    />
                  </View>
                </TouchableOpacity>

                {/* Bank Name */}
                <TouchableOpacity 
                  style={[styles.detailRow, styles.detailRowLast]}
                  onPress={() => copyToClipboard(BANK_DETAILS.bankName, 'Bank Name')}
                >
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailLabel}>Bank</Text>
                    <Text style={styles.detailValue}>{BANK_DETAILS.bankName}</Text>
                  </View>
                  <View style={[styles.copyButton, copiedField === 'Bank Name' && styles.copyButtonCopied]}>
                    <Ionicons 
                      name={copiedField === 'Bank Name' ? 'checkmark' : 'copy-outline'} 
                      size={18} 
                      color={copiedField === 'Bank Name' ? '#22c55e' : palette.muted} 
                    />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Copy All Button */}
              <TouchableOpacity style={styles.copyAllButton} onPress={copyAllDetails}>
                <Ionicons name="clipboard-outline" size={18} color="#1f2937" />
                <Text style={styles.copyAllText}>Copy All Details</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Payment Methods */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Accepted Payment Methods</Text>
            <View style={styles.methodsGrid}>
              <View style={styles.methodCard}>
                <Ionicons name="swap-horizontal" size={24} color="#3b82f6" />
                <Text style={styles.methodText}>EFT Transfer</Text>
              </View>
              <View style={styles.methodCard}>
                <Ionicons name="business" size={24} color="#22c55e" />
                <Text style={styles.methodText}>Bank Deposit</Text>
              </View>
              <View style={styles.methodCard}>
                <Ionicons name="phone-portrait" size={24} color="#8b5cf6" />
                <Text style={styles.methodText}>Mobile Banking</Text>
              </View>
              <View style={styles.methodCard}>
                <Ionicons name="card" size={24} color="#f59e0b" />
                <Text style={styles.methodText}>Internet Banking</Text>
              </View>
            </View>
          </View>

          {/* Thank You Section */}
          <View style={styles.thankYouSection}>
            <Text style={styles.thankYouEmoji}>🙏</Text>
            <Text style={styles.thankYouTitle}>Thank You</Text>
            <Text style={styles.thankYouText}>
              Every donation, no matter the size, helps keep this prayer community running. 
              We are deeply grateful for your support and generosity.
            </Text>
            <Text style={styles.thankYouVerse}>
              "Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver."
            </Text>
            <Text style={styles.verseReference}>— 2 Corinthians 9:7</Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  heartContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  heartEmoji: {
    fontSize: 50,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: palette.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontSize: 16,
    color: palette.muted,
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
    color: palette.text,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: palette.muted,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  reasonCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  reasonIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
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
    color: palette.text,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: palette.muted,
    lineHeight: 20,
  },
  bankCard: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  bankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: '#16a34a',
  },
  bankLogoContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
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
    color: '#fff',
  },
  accountType: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  bankDetails: {
    padding: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailInfo: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
  },
  detailValueLarge: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text,
    letterSpacing: 1,
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonCopied: {
    backgroundColor: '#dcfce7',
  },
  copyAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    margin: spacing.md,
    marginTop: 0,
    borderRadius: radius.md,
  },
  copyAllText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  methodCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  methodText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  thankYouSection: {
    backgroundColor: '#fef3c7',
    borderRadius: radius.lg,
    padding: spacing.xl,
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
    color: '#b45309',
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
    color: '#b45309',
    marginTop: spacing.xs,
    fontWeight: '600',
  },
});

export default DonationScreen;

