import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let app: any;
let dbInstance: any;

try {
  // Only initialize if we have at least a project ID
  if (firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    dbInstance = getFirestore(app);
  }
} catch (error) {
  console.warn('Firebase initialization failed:', error);
  console.warn('Make sure your .env.local file has Firebase credentials configured');
}

export const db = dbInstance;

export interface OnboardingAnalytics {
  email: string;
  full_name: string;
  step1?: string;
  step2?: string[];
  step3?: string[];
  step4?: string;
  step5?: string;
  role?: 'creator' | 'talent';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export function sanitizeEmailForDoc(email: string): string {
  return email.toLowerCase().replace(/[.#[\]$]/g, '_');
}

export async function saveOnboardingData(
  email: string,
  data: Omit<OnboardingAnalytics, 'email' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  if (!db) {
    console.warn('Firebase not configured. Skipping analytics save.');
    return;
  }

  try {
    const sanitizedEmail = sanitizeEmailForDoc(email);
    const docRef = doc(db, 'onboarding_analytics', sanitizedEmail);
    const timestamp = Timestamp.now();
    
    await setDoc(
      docRef,
      {
        ...data,
        email,
        updatedAt: timestamp,
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error saving onboarding data:', error);
    throw error;
  }
}
