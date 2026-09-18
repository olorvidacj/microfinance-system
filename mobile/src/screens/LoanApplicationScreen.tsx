import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { api } from '../services/api';
import { LoanProduct, LoanApplication } from '../types';

export const LoanApplicationScreen: React.FC = () => {
  const [viewMode, setViewMode] = useState<'apply' | 'history'>('apply');
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Products & History State
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [applications, setApplications] = useState<LoanApplication[]>([]);

  // Step 1 & 2: Product & Terms
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);
  const [amount, setAmount] = useState<string>('30000');
  const [termMonths, setTermMonths] = useState<number>(6);
  const [calculation, setCalculation] = useState<any>(null);

  // Step 3: Required Details
  const [purpose, setPurpose] = useState<string>('Sari-sari store expansion & wholesale grocery restocking');
  const [repaymentFrequency, setRepaymentFrequency] = useState<string>('Monthly');
  const [guarantorName, setGuarantorName] = useState<string>('Roberto Dela Cruz');
  const [guarantorPhone, setGuarantorPhone] = useState<string>('+63 918 444 8899');
  const [collateralDescription, setCollateralDescription] = useState<string>('Store equipment & personal chattel');

  // Step 4: Documents
  const [uploadedDocs, setUploadedDocs] = useState<{ name: string; type: string; uploaded: boolean }[]>([
    { name: 'Government Photo ID (Front & Back)', type: 'VALID_ID', uploaded: true },
    { name: 'Proof of Income / 3-Month DTI Records', type: 'PROOF_INCOME', uploaded: true },
    { name: 'Barangay Clearance / Proof of Residence', type: 'PROOF_RESIDENCE', uploaded: true },
  ]);

  // Submission success result
  const [submittedApplication, setSubmittedApplication] = useState<any>(null);

  const fetchData = async () => {
    try {
      const [prods, apps] = await Promise.all([
        api.getLoanProducts(),
        api.getLoanApplications(),
      ]);
      setProducts(prods);
      if (prods.length > 0) {
        setSelectedProduct(prods[0]);
      }
      setApplications(apps);
    } catch (err: any) {
      console.warn('[LoanApply] Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute Amortization in Real Time
  useEffect(() => {
    if (selectedProduct && amount) {
      const numAmount = Number(amount) || 10000;
      api
        .calculateLoan({
          amount: numAmount,
          termMonths,
          interestRatePerMonth: selectedProduct.interestRatePerMonth,
          interestType: selectedProduct.interestType,
        })
        .then(setCalculation)
        .catch(() => {});
    }
  }, [selectedProduct, amount, termMonths]);

  const handleNextStep = () => {
    if (step === 1) {
      if (!selectedProduct) {
        Alert.alert('Selection Required', 'Please select a loan product.');
        return;
      }
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount < selectedProduct.minAmount || numAmount > selectedProduct.maxAmount) {
        Alert.alert(
          'Invalid Amount',
          `Amount must be between ₱${selectedProduct.minAmount.toLocaleString()} and ₱${selectedProduct.maxAmount.toLocaleString()}.`
        );
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!purpose.trim()) {
        Alert.alert('Required', 'Please enter your specific loan purpose.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4); // Review
    }
  };

  const handleSubmit = async () => {
    if (!selectedProduct) return;
    setSubmitting(true);
    try {
      const res = await api.submitLoanApplication({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        amount: Number(amount),
        termMonths,
        repaymentFrequency,
        purpose,
        guarantorName,
        guarantorPhone,
        collateralDescription,
        documents: uploadedDocs.filter((d) => d.uploaded).map((d) => d.type),
      });

      setSubmittedApplication(res.application);
      Alert.alert('Success', 'Your loan application has been submitted to the cooperative!');
      fetchData();
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Unable to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmittedApplication(null);
    setStep(1);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading loan products...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* View Switcher: Apply vs My Applications */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabButton, viewMode === 'apply' && styles.tabButtonActive]}
          onPress={() => setViewMode('apply')}
        >
          <Text style={[styles.tabButtonText, viewMode === 'apply' && styles.tabButtonTextActive]}>
            Apply for Loan
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, viewMode === 'history' && styles.tabButtonActive]}
          onPress={() => setViewMode('history')}
        >
          <Text style={[styles.tabButtonText, viewMode === 'history' && styles.tabButtonTextActive]}>
            Application Status ({applications.length})
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'history' ? (
        /* History & Status Tracking View */
        <View>
          <Text style={styles.sectionTitle}>Submitted Loan Applications</Text>
          <Text style={styles.sectionSubtitle}>
            Track real-time underwriting status, approval decisions, and committee comments.
          </Text>

          {applications.map((app) => (
            <View key={app.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <View>
                  <Text style={styles.historyProduct}>{app.productName}</Text>
                  <Text style={styles.historyDate}>Submitted on: {app.applicationDate}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    app.status === 'APPROVED' && styles.statusApproved,
                    app.status === 'PENDING' && styles.statusPending,
                    app.status === 'REJECTED' && styles.statusRejected,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      app.status === 'APPROVED' && styles.statusTextApproved,
                      app.status === 'PENDING' && styles.statusTextPending,
                      app.status === 'REJECTED' && styles.statusTextRejected,
                    ]}
                  >
                    {app.status}
                  </Text>
                </View>
              </View>

              <View style={styles.historyDivider} />

              <View style={styles.historyGrid}>
                <View style={styles.historyCol}>
                  <Text style={styles.historyLabel}>Principal Amount</Text>
                  <Text style={styles.historyValue}>₱ {app.principalAmount?.toLocaleString()}</Text>
                </View>
                <View style={styles.historyCol}>
                  <Text style={styles.historyLabel}>Term</Text>
                  <Text style={styles.historyValue}>{app.termMonths} Months</Text>
                </View>
                <View style={styles.historyCol}>
                  <Text style={styles.historyLabel}>Workflow Stage</Text>
                  <Text style={[styles.historyValue, { color: '#0284C7' }]}>
                    {app.coopStep || 'Credit Committee'}
                  </Text>
                </View>
              </View>

              {/* Rejection Reason Display if Applicable */}
              {app.status === 'REJECTED' && app.rejectionReason && (
                <View style={styles.rejectionBox}>
                  <Text style={styles.rejectionTitle}>⚠️ Rejection Reason:</Text>
                  <Text style={styles.rejectionText}>{app.rejectionReason}</Text>
                </View>
              )}

              {app.status === 'APPROVED' && (
                <View style={styles.approvedBox}>
                  <Text style={styles.approvedText}>
                    ✓ Approved by Credit Committee. Ready for release or disbursed.
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      ) : submittedApplication ? (
        /* Submission Confirmation Card */
        <View style={styles.successCard}>
          <View style={styles.successIconBg}>
            <Text style={{ fontSize: 32 }}>🎉</Text>
          </View>
          <Text style={styles.successTitle}>Application Submitted!</Text>
          <Text style={styles.successRef}>Application Ref: {submittedApplication.id}</Text>
          <Text style={styles.successDesc}>
            Your application for ₱{submittedApplication.principalAmount?.toLocaleString()} under{' '}
            {submittedApplication.productName} has been transmitted to our Loan Officers.
          </Text>

          <View style={styles.statusBox}>
            <View style={styles.statusBoxRow}>
              <Text style={styles.statusBoxLabel}>Current Status:</Text>
              <View style={[styles.statusBadge, styles.statusPending]}>
                <Text style={[styles.statusBadgeText, styles.statusTextPending]}>PENDING REVIEW</Text>
              </View>
            </View>
            <View style={styles.statusBoxRow}>
              <Text style={styles.statusBoxLabel}>Application Date:</Text>
              <Text style={styles.statusBoxValue}>{submittedApplication.applicationDate}</Text>
            </View>
            <View style={styles.statusBoxRow}>
              <Text style={styles.statusBoxLabel}>Est. Monthly Amortization:</Text>
              <Text style={[styles.statusBoxValue, { color: '#059669', fontWeight: '800' }]}>
                ₱ {submittedApplication.monthlyInstallment?.toLocaleString()}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={() => setViewMode('history')}>
            <Text style={styles.primaryButtonText}>View In Application Tracker</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={resetForm}>
            <Text style={styles.secondaryButtonText}>Submit Another Application</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Multi-Step Application Wizard */
        <View>
          {/* Step Progress Bar */}
          <View style={styles.progressRow}>
            {[1, 2, 3, 4].map((s) => (
              <View key={s} style={styles.progressItem}>
                <View
                  style={[
                    styles.progressCircle,
                    step >= s ? styles.progressCircleActive : styles.progressCircleInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.progressText,
                      step >= s ? styles.progressTextActive : styles.progressTextInactive,
                    ]}
                  >
                    {s}
                  </Text>
                </View>
                <Text style={styles.progressLabel}>
                  {s === 1 ? 'Product' : s === 2 ? 'Terms' : s === 3 ? 'Info' : 'Review'}
                </Text>
              </View>
            ))}
          </View>

          {/* STEP 1: Select Loan Product & Amount */}
          {step === 1 && (
            <View style={styles.wizardCard}>
              <Text style={styles.wizardTitle}>1. Select Loan Facility</Text>
              <Text style={styles.wizardSubtitle}>Choose the product that fits your financial need.</Text>

              {products.map((prod) => (
                <TouchableOpacity
                  key={prod.id}
                  style={[
                    styles.productOption,
                    selectedProduct?.id === prod.id && styles.productOptionSelected,
                  ]}
                  onPress={() => setSelectedProduct(prod)}
                >
                  <View style={styles.productOptionHeader}>
                    <Text style={styles.productOptionName}>{prod.name}</Text>
                    <Text style={styles.productOptionRate}>{prod.interestRatePerMonth}% / mo</Text>
                  </View>
                  <Text style={styles.productOptionDesc}>{prod.description}</Text>
                  <Text style={styles.productOptionLimit}>
                    Range: ₱{prod.minAmount.toLocaleString()} – ₱{prod.maxAmount.toLocaleString()} • Tenor: {prod.minTermMonths}–{prod.maxTermMonths} mos
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.wizardTitle, { marginTop: 18 }]}>Enter Loan Amount</Text>
              <View style={styles.amountInputRow}>
                <Text style={styles.currencyPrefix}>₱</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="30000"
                />
              </View>

              <Text style={[styles.wizardTitle, { marginTop: 18 }]}>Select Repayment Term</Text>
              <View style={styles.termPills}>
                {[3, 6, 12, 18, 24].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.termPill, termMonths === t && styles.termPillActive]}
                    onPress={() => setTermMonths(t)}
                  >
                    <Text style={[styles.termPillText, termMonths === t && styles.termPillTextActive]}>
                      {t} Months
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Real-time Estimated Amortization Box */}
              {calculation && (
                <View style={styles.calcBox}>
                  <Text style={styles.calcTitle}>💡 Estimated Installment Calculator</Text>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Estimated Monthly Payment:</Text>
                    <Text style={styles.calcValueHighlight}>
                      ₱ {calculation.estimatedMonthlyPayment?.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Total Accumulated Interest:</Text>
                    <Text style={styles.calcValue}>₱ {calculation.estimatedTotalInterest?.toLocaleString()}</Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Est. 2% Processing Fee:</Text>
                    <Text style={styles.calcValue}>₱ {calculation.processingFee?.toLocaleString()}</Text>
                  </View>
                </View>
              )}

              <TouchableOpacity style={styles.primaryButton} onPress={handleNextStep}>
                <Text style={styles.primaryButtonText}>Continue to Borrower Details →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: Required Borrower Information & Guarantor */}
          {step === 2 && (
            <View style={styles.wizardCard}>
              <Text style={styles.wizardTitle}>2. Required Information</Text>
              <Text style={styles.wizardSubtitle}>Provide loan purpose, guarantor, and security details.</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Specific Purpose of Loan</Text>
                <TextInput
                  style={[styles.fieldInput, { height: 60 }]}
                  value={purpose}
                  onChangeText={setPurpose}
                  placeholder="e.g. Working capital for dry goods, tuition fee, home repair"
                  multiline
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Preferred Repayment Frequency</Text>
                <View style={styles.termPills}>
                  {['Monthly', 'Bi-Weekly', 'Weekly'].map((freq) => (
                    <TouchableOpacity
                      key={freq}
                      style={[styles.termPill, repaymentFrequency === freq && styles.termPillActive]}
                      onPress={() => setRepaymentFrequency(freq)}
                    >
                      <Text style={[styles.termPillText, repaymentFrequency === freq && styles.termPillTextActive]}>
                        {freq}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Co-Maker / Guarantor Name</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={guarantorName}
                  onChangeText={setGuarantorName}
                  placeholder="Full legal name of co-borrower"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Guarantor Mobile Contact</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={guarantorPhone}
                  onChangeText={setGuarantorPhone}
                  keyboardType="phone-pad"
                  placeholder="+63 9XX XXX XXXX"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Collateral / Asset Guarantee (Optional)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={collateralDescription}
                  onChangeText={setCollateralDescription}
                  placeholder="e.g. Sari-sari store inventory, motorcycle chattel, salary assignment"
                />
              </View>

              <View style={styles.wizardNavRow}>
                <TouchableOpacity style={styles.secondaryButtonHalf} onPress={() => setStep(1)}>
                  <Text style={styles.secondaryButtonText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButtonHalf} onPress={handleNextStep}>
                  <Text style={styles.primaryButtonText}>Upload Docs →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 3: Required Document Uploads */}
          {step === 3 && (
            <View style={styles.wizardCard}>
              <Text style={styles.wizardTitle}>3. Upload Required Documents</Text>
              <Text style={styles.wizardSubtitle}>Attach digital copies for instant AI Credit Investigation.</Text>

              {uploadedDocs.map((doc, idx) => (
                <View key={idx} style={styles.docUploadItem}>
                  <View style={styles.docUploadIcon}>
                    <Text style={{ fontSize: 18 }}>{doc.uploaded ? '✅' : '📤'}</Text>
                  </View>
                  <View style={styles.docUploadDetails}>
                    <Text style={styles.docUploadName}>{doc.name}</Text>
                    <Text style={styles.docUploadStatus}>
                      {doc.uploaded ? 'Attached (Ready for Underwriting)' : 'Pending attachment'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.docUploadAction}
                    onPress={() => {
                      const updated = [...uploadedDocs];
                      updated[idx].uploaded = true;
                      setUploadedDocs(updated);
                      Alert.alert('Attached', `Sample file attached for ${doc.name}`);
                    }}
                  >
                    <Text style={styles.docUploadActionText}>{doc.uploaded ? 'Replace' : 'Upload'}</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <View style={styles.wizardNavRow}>
                <TouchableOpacity style={styles.secondaryButtonHalf} onPress={() => setStep(2)}>
                  <Text style={styles.secondaryButtonText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButtonHalf} onPress={handleNextStep}>
                  <Text style={styles.primaryButtonText}>Review Application →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 4: Review Application & Final Submit */}
          {step === 4 && (
            <View style={styles.wizardCard}>
              <Text style={styles.wizardTitle}>4. Review & Confirm Application</Text>
              <Text style={styles.wizardSubtitle}>Please verify all information before submitting to the cooperative.</Text>

              <View style={styles.reviewBox}>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Product:</Text>
                  <Text style={styles.reviewValue}>{selectedProduct?.name}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Requested Amount:</Text>
                  <Text style={[styles.reviewValue, { fontWeight: '800', color: '#0F172A' }]}>
                    ₱ {Number(amount).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Term / Amortization:</Text>
                  <Text style={styles.reviewValue}>{termMonths} Months ({repaymentFrequency})</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Est. Monthly Payment:</Text>
                  <Text style={[styles.reviewValue, { color: '#059669', fontWeight: '800' }]}>
                    ₱ {calculation?.estimatedMonthlyPayment?.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Guarantor:</Text>
                  <Text style={styles.reviewValue}>{guarantorName || 'None'}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Purpose:</Text>
                  <Text style={styles.reviewValue}>{purpose}</Text>
                </View>
              </View>

              <View style={styles.disclaimerBox}>
                <Text style={styles.disclaimerText}>
                  ⚖️ By clicking Submit, you authorize HOSCOMO Microfinance to conduct credit verification and acknowledge adherence to cooperative lending rules.
                </Text>
              </View>

              <View style={styles.wizardNavRow}>
                <TouchableOpacity style={styles.secondaryButtonHalf} onPress={() => setStep(3)}>
                  <Text style={styles.secondaryButtonText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButtonHalf, { backgroundColor: '#059669' }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Confirm & Submit 🚀</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  progressItem: {
    alignItems: 'center',
  },
  progressCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressCircleActive: {
    backgroundColor: '#059669',
  },
  progressCircleInactive: {
    backgroundColor: '#CBD5E1',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressTextActive: {
    color: '#FFFFFF',
  },
  progressTextInactive: {
    color: '#64748B',
  },
  progressLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  wizardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  wizardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  wizardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  productOption: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  productOptionSelected: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  productOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  productOptionName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  productOptionRate: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  productOptionDesc: {
    fontSize: 11,
    color: '#475569',
    marginBottom: 4,
  },
  productOptionLimit: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  termPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  termPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  termPillActive: {
    backgroundColor: '#059669',
  },
  termPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  termPillTextActive: {
    color: '#FFFFFF',
  },
  calcBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    marginVertical: 16,
  },
  calcTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    marginBottom: 8,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  calcLabel: {
    fontSize: 11,
    color: '#475569',
  },
  calcValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  calcValueHighlight: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  docUploadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  docUploadIcon: {
    marginRight: 10,
  },
  docUploadDetails: {
    flex: 1,
  },
  docUploadName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  docUploadStatus: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  docUploadAction: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  docUploadActionText: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  reviewBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  reviewValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    maxWidth: '60%',
    textAlign: 'right',
  },
  disclaimerBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#92400E',
    lineHeight: 16,
  },
  wizardNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButtonHalf: {
    flex: 1,
    marginLeft: 6,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonHalf: {
    flex: 0.8,
    marginRight: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  secondaryButtonText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  historyProduct: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  historyDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  historyDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  historyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyCol: {
    flex: 1,
  },
  historyLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 2,
  },
  historyValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusApproved: {
    backgroundColor: '#ECFDF5',
  },
  statusPending: {
    backgroundColor: '#FFFBEB',
  },
  statusRejected: {
    backgroundColor: '#FEF2F2',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextApproved: {
    color: '#059669',
  },
  statusTextPending: {
    color: '#D97706',
  },
  statusTextRejected: {
    color: '#DC2626',
  },
  rejectionBox: {
    marginTop: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
  },
  rejectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: 2,
  },
  rejectionText: {
    fontSize: 11,
    color: '#991B1B',
  },
  approvedBox: {
    marginTop: 10,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 8,
  },
  approvedText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  successIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  successRef: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '700',
    marginTop: 2,
  },
  successDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  statusBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginVertical: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusBoxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBoxLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  statusBoxValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
});
