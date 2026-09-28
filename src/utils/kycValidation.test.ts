import { describe, it, expect } from 'vitest';

describe('Philippine Mobile Normalization', () => {
  const normalizePhone = (raw: string): string => {
    let clean = raw.replace(/\D/g, '');
    if (clean.startsWith('63')) {
      clean = '0' + clean.slice(2);
    }
    return clean;
  };

  const isValidPhPhone = (phone: string): boolean => {
    const normalized = normalizePhone(phone);
    return /^09\d{9}$/.test(normalized);
  };

  it('normalizes 09171234567 format', () => {
    expect(normalizePhone('09171234567')).toBe('09171234567');
    expect(isValidPhPhone('09171234567')).toBe(true);
  });

  it('normalizes +639171234567 format', () => {
    expect(normalizePhone('+639171234567')).toBe('09171234567');
    expect(isValidPhPhone('+639171234567')).toBe(true);
  });

  it('normalizes 639171234567 format', () => {
    expect(normalizePhone('639171234567')).toBe('09171234567');
    expect(isValidPhPhone('639171234567')).toBe(true);
  });

  it('rejects invalid numbers and non-ph prefixes', () => {
    expect(isValidPhPhone('08171234567')).toBe(false);
    expect(isValidPhPhone('12345')).toBe(false);
    expect(isValidPhPhone('0917123456')).toBe(false); // only 10 digits
    expect(isValidPhPhone('091712345678')).toBe(false); // 12 digits
  });
});

describe('Legal Name Validation', () => {
  const formatFullName = (data: {
    firstName: string;
    middleName?: string;
    lastName: string;
    suffix?: string;
    hasNoMiddleName?: boolean;
  }) => {
    const parts = [data.firstName.trim()];
    if (!data.hasNoMiddleName && data.middleName && data.middleName.trim()) {
      parts.push(data.middleName.trim());
    }
    parts.push(data.lastName.trim());
    if (data.suffix && data.suffix.trim()) {
      parts.push(data.suffix.trim());
    }
    return parts.join(' ');
  };

  it('formats full name with middle name', () => {
    const name = formatFullName({
      firstName: 'Juan',
      middleName: 'Santos',
      lastName: 'Dela Cruz',
      suffix: 'Jr.',
    });
    expect(name).toBe('Juan Santos Dela Cruz Jr.');
  });

  it('formats full name without middle name when hasNoMiddleName is checked', () => {
    const name = formatFullName({
      firstName: 'Maria',
      hasNoMiddleName: true,
      lastName: 'Santos',
    });
    expect(name).toBe('Maria Santos');
  });

  it('does not require typing NA or None for middle name', () => {
    const name = formatFullName({
      firstName: 'Pedro',
      middleName: '',
      hasNoMiddleName: true,
      lastName: 'Penduko',
    });
    expect(name).toBe('Pedro Penduko');
  });
});

describe('7-Step KYC Completeness Verification', () => {
  const validateKycCompleteness = (submission: {
    personalInfo: any;
    address: any;
    contactInfo: any;
    employment: any;
    governmentId: any;
    kycDocuments: any[];
    declarations: any;
  }) => {
    const errors: string[] = [];
    // 1. Personal
    if (!submission.personalInfo?.firstName || !submission.personalInfo?.lastName || !submission.personalInfo?.dateOfBirth) {
      errors.push('Personal Information is incomplete');
    }
    // 2. Address (PSGC)
    if (!submission.address?.region || !submission.address?.city || !submission.address?.barangay || !submission.address?.streetAddress) {
      errors.push('Current PSGC Address is incomplete');
    }
    // 3. Contact
    if (!submission.contactInfo?.mobileNumber) {
      errors.push('Mobile Number is required');
    }
    // 4. Employment & Financial
    if (!submission.employment?.employmentStatus || submission.employment?.monthlyIncome === undefined || submission.employment?.monthlyIncome < 0) {
      errors.push('Employment & Financial profile is incomplete');
    }
    // 5. Government ID
    if (!submission.governmentId?.idType || !submission.governmentId?.idNumber) {
      errors.push('Government ID details are incomplete');
    }
    // 6. Documents
    if (!submission.kycDocuments || submission.kycDocuments.length === 0) {
      errors.push('Required KYC documents are missing');
    }
    // 7. Declarations
    if (!submission.declarations?.dataPrivacyConsent || !submission.declarations?.informationAccuracy) {
      errors.push('Mandatory declarations and consents are required');
    }

    return { isValid: errors.length === 0, errors };
  };

  it('validates a complete 7-step submission', () => {
    const completeSubmission = {
      personalInfo: {
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        dateOfBirth: '1990-05-15',
        civilStatus: 'Single',
        gender: 'Male',
      },
      address: {
        region: 'National Capital Region (NCR)',
        regionCode: '130000000',
        city: 'City of Manila',
        cityCode: '133900000',
        barangay: 'Barangay 659',
        barangayCode: '133900001',
        postalCode: '1000',
        streetAddress: '123 Rizal Ave',
      },
      contactInfo: {
        mobileNumber: '09171234567',
        email: 'juan@example.com',
      },
      employment: {
        employmentStatus: 'Employed',
        employerOrBusiness: 'Tech Corp',
        occupation: 'Specialist',
        monthlyIncome: 35000,
        monthlyExpenses: 15000,
      },
      governmentId: {
        idType: 'Philippine National ID (PhilSys)',
        idNumber: '1234-5678-9012-3456',
        nameOnId: 'JUAN DELA CRUZ',
      },
      kycDocuments: [
        { docType: 'GOVERNMENT_ID', fileName: 'philsys_id.jpg', fileSize: 102400 },
        { docType: 'PROOF_OF_INCOME', fileName: 'payslip.pdf', fileSize: 204800 },
      ],
      declarations: {
        dataPrivacyConsent: true,
        informationAccuracy: true,
        termsAndConditions: true,
        amlDeclaration: true,
        eSignatureConsent: true,
      },
    };

    const res = validateKycCompleteness(completeSubmission);
    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('fails completeness validation when required sections or documents are missing', () => {
    const incompleteSubmission = {
      personalInfo: {
        firstName: 'Juan',
        // missing lastName & dob
      },
      address: {
        region: 'NCR',
        // missing city & barangay
      },
      contactInfo: {},
      employment: {
        monthlyIncome: -500, // invalid negative income
      },
      governmentId: {},
      kycDocuments: [],
      declarations: {
        dataPrivacyConsent: false,
      },
    };

    const res = validateKycCompleteness(incompleteSubmission as any);
    expect(res.isValid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(3);
  });
});
