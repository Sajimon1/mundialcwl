import React, { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs, 
  query,
  where
} from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInAnonymously, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth, handleFirestoreError, testConnection } from './firebase';
import { Match, UserProfile, Prediction, OperationType } from './types';
import MatchList from './components/MatchList';
import Leaderboard from './components/Leaderboard';
import AdminPanel from './components/AdminPanel';
import RulesInfo from './components/RulesInfo';
import { 
  Trophy, 
  LogOut, 
  LogIn, 
  HelpCircle, 
  Settings, 
  AlertCircle, 
  User, 
  Flame, 
  ShieldCheck, 
  ShieldAlert, 
  Gamepad2,
  Lock,
  Mail,
  UserPlus,
  X
} from 'lucide-react';

const DISCORD_AVATARS = [
  "https://cdn.discordapp.com/embed/avatars/0.png", // Blurple
  "https://cdn.discordapp.com/embed/avatars/1.png", // Grey
  "https://cdn.discordapp.com/embed/avatars/2.png", // Green
  "https://cdn.discordapp.com/embed/avatars/3.png", // Yellow
  "https://cdn.discordapp.com/embed/avatars/4.png", // Red
  "https://cdn.discordapp.com/embed/avatars/5.png"  // Magenta/Pink
];

export default function App() {
  // Authentication & Session
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFirebaseRestricted, setIsFirebaseRestricted] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState<boolean>(false);
  const [localProfiles, setLocalProfiles] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("predictor_local_users") || "[]");
    } catch {
      return [];
    }
  });

  // Firestore Data Collections
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  
  // App State Logs / Control
  const [showRules, setShowRules] = useState(false);
  const [activeTab, setActiveTab] = useState<"matches" | "standings" | "admin">("matches");

  // Discord/Auth Authorization Stg Form
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(DISCORD_AVATARS[0]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // Expanded Auth Methods
  const [authMethod, setAuthMethod] = useState<"google" | "email" | "guest" | "local">("local");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isEmailSignUp, setIsEmailSignUp] = useState(false);

  const [countdownText, setCountdownText] = useState("00:00:00");

  // In-app elegant dialog modal state targeting iframe limitations
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'prompt';
    title: string;
    message: string;
    placeholder?: string;
    value?: string;
    onResolve?: (value: any) => void;
  }>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
    placeholder: '',
    value: '',
  });

  const customAlert = (message: string, title: string = "Informacja"): Promise<void> => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        type: 'alert',
        title,
        message,
        onResolve: () => {
          setModal(prev => ({ ...prev, isOpen: false }));
          resolve();
        }
      });
    });
  };

  const customConfirm = (message: string, title: string = "Potwierdzenie"): Promise<boolean> => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        type: 'confirm',
        title,
        message,
        onResolve: (val) => {
          setModal(prev => ({ ...prev, isOpen: false }));
          resolve(!!val);
        }
      });
    });
  };

  const customPrompt = (message: string, placeholder: string = "", defaultValue: string = "", title: string = "Wymagane dane"): Promise<string | null> => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        type: 'prompt',
        title,
        message,
        placeholder,
        value: defaultValue,
        onResolve: (val) => {
          setModal(prev => ({ ...prev, isOpen: false }));
          resolve(val);
        }
      });
    });
  };

  // Countdown clock to nearest scheduled match
  useEffect(() => {
    const interval = setInterval(() => {
      const scheduledMatches = matches.filter(m => m.status === "scheduled");
      if (scheduledMatches.length === 0) {
        setCountdownText("BRAK MECZÓW");
        return;
      }
      const sorted = [...scheduledMatches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const nextMatch = sorted[0];
      const diff = new Date(nextMatch.date).getTime() - Date.now();
      if (diff <= 0) {
        setCountdownText("LIVE");
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdownText(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [matches]);

  // Test connection to Firestore on initial component mount safely
  useEffect(() => {
    testConnection();
  }, []);

  // 1. Setup Firebase Auth Session Listener & Cache
  useEffect(() => {
    const initSession = async () => {
      // Restore user credentials from local storage cache
      const cached = localStorage.getItem("predictor_user_profile");
      if (cached) {
        try {
          const profile = JSON.parse(cached);
          setCurrentUser(profile);
          setIsAuthenticated(true);
        } catch (e) {
          console.error("Failed to restore cached user session:", e);
        }
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
      setLoadingAuth(false);
    };

    initSession();
  }, []);

  // 1b. Realtime database subscription listeners - only triggered when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setUsers([]);
      setMatches([]);
      setPredictions([]);
      return;
    }

    // Realtime users listener
    const usersPath = 'users';
    const unsubUsers = onSnapshot(collection(db, usersPath), (snapshot) => {
      const usersData: UserProfile[] = [];
      snapshot.forEach(doc => {
        usersData.push(doc.data() as UserProfile);
      });
      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, usersPath);
    });

    // Realtime matches listener
    const matchesPath = 'matches';
    const unsubMatches = onSnapshot(collection(db, matchesPath), async (snapshot) => {
      const matchesData: Match[] = [];
      snapshot.forEach(doc => {
        matchesData.push(doc.data() as Match);
      });
      
      // Auto-seed default matches in cloud if completely empty!
      if (matchesData.length === 0) {
        const defaultMatches: Match[] = [
          { id: "match_1", teamA: "Polska", teamB: "Austria", date: new Date(Date.now() + 86400000).toISOString(), status: "scheduled", group: "Grupa A" },
          { id: "match_2", teamA: "Francja", teamB: "Holandia", date: new Date(Date.now() + 172800000).toISOString(), status: "scheduled", group: "Grupa A" },
          { id: "match_3", teamA: "Niemcy", teamB: "Szkocja", date: new Date(Date.now() - 3600000).toISOString(), status: "finished", group: "Grupa B", scoreA: 3, scoreB: 1 },
          { id: "match_4", teamA: "Hiszpania", teamB: "Włochy", date: new Date(Date.now() + 259200000).toISOString(), status: "scheduled", group: "Grupa B" },
        ];
        const { setDoc, doc } = await import('firebase/firestore');
        for (const m of defaultMatches) {
          try {
            await setDoc(doc(db, 'matches', m.id), m);
          } catch (err) {
            console.error("Failed to seed match:", err);
          }
        }
      } else {
        setMatches(matchesData);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, matchesPath);
    });

    // Realtime predictions listener
    const predictionsPath = 'predictions';
    const currentUid = currentUser?.uid || '';
    const q = query(collection(db, predictionsPath), where('userId', '==', currentUid));
    const unsubPredictions = onSnapshot(q, (snapshot) => {
      const predictionsData: Prediction[] = [];
      snapshot.forEach(doc => {
        predictionsData.push(doc.data() as Prediction);
      });
      setPredictions(predictionsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, predictionsPath);
    });

    return () => {
      unsubUsers();
      unsubMatches();
      unsubPredictions();
    };
  }, [isAuthenticated, isLocalMode, currentUser?.uid]);

  // Update current user state whenever users list or local record is updated
  useEffect(() => {
    if (currentUser) {
      const freshProfile = users.find(u => u.uid === currentUser.uid);
      if (freshProfile) {
        setCurrentUser(freshProfile);
        localStorage.setItem("predictor_user_profile", JSON.stringify(freshProfile));
      }
    }
  }, [users]);

  // 2. Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    setAuthError("");
    setSubmittingAuth(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      const authResult = await signInWithPopup(auth, provider);
      const user = authResult.user;
      
      if (user) {
        // Fetch profile
        const { getDoc, doc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
          const profile = userDoc.data() as UserProfile;
          setCurrentUser(profile);
          localStorage.setItem("predictor_user_profile", JSON.stringify(profile));
          setActiveTab("matches");
        } else {
          // Pre-populate username with clean display name if available
          if (user.displayName) {
            const cleanName = user.displayName.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
            setUsername(cleanName);
          }
          // currentUser remains null while isAuthenticated is true, putting the user in Onboarding phase
          setCurrentUser(null);
        }
      }
    } catch (err: any) {
      console.error("Google Sign-In Error: ", err);
      if (err?.code === "auth/popup-blocked") {
        setAuthError("Okno logowania zostało zablokowane przez przeglądarkę. Zezwól na wyskakujące okna i spróbuj ponownie.");
      } else if (err?.code === "auth/admin-restricted-operation" || err?.message?.includes("admin-restricted-operation")) {
        setIsFirebaseRestricted(true);
        setAuthError("Logowanie anonimowe jest wyłączone w Twoim projekcie Firebase!");
      } else {
        setAuthError(`Błąd logowania Google: ${err?.message || err}`);
      }
    } finally {
      setSubmittingAuth(false);
    }
  };

  // 2c. Google Sign-In with Redirect Handler (for mobile or blocked popups or Vercel setups)
  const handleGoogleSignInWithRedirect = async () => {
    setAuthError("");
    setSubmittingAuth(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      console.error("Google Redirect Sign-In Error: ", err);
      if (err?.code === "auth/unauthorized-domain") {
        setAuthError("Błąd domeny: Ten adres URL nie został dodany do 'Autoryzowanych domen' w Twoim panelu Firebase Console -> Auth -> Ustawienia.");
      } else {
        setAuthError(`Błąd logowania przekierowaniem Google: ${err?.message || err}`);
      }
      setSubmittingAuth(false);
    }
  };

  // 2d. Email/Password Authentication Handler
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setAuthError("Podaj adres e-mail i hasło!");
      return;
    }
    if (trimmedPassword.length < 6) {
      setAuthError("Hasło musi mieć co najmniej 6 znaków!");
      return;
    }

    setSubmittingAuth(true);
    try {
      let authResult;
      if (isEmailSignUp) {
        authResult = await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      } else {
        authResult = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      }
      const user = authResult.user;
      if (user) {
        const { getDoc, doc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const profile = userDoc.data() as UserProfile;
          setCurrentUser(profile);
          localStorage.setItem("predictor_user_profile", JSON.stringify(profile));
          setActiveTab("matches");
        } else {
          // Trigger onboarding phase
          setUsername("");
          setCurrentUser(null);
        }
      }
    } catch (err: any) {
      console.error("E-mail Auth Error: ", err);
      if (err?.code === "auth/operation-not-allowed" || err?.message?.includes("operation-not-allowed")) {
        setAuthError("firebase-email-disabled");
      } else {
        let readableError = err?.message || err;
        if (err?.code === "auth/email-already-in-use") {
          readableError = "Ten e-mail jest już zarejestrowany. Zaloguj się lub użyj innego.";
        } else if (err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password" || err?.code === "auth/user-not-found") {
          readableError = "Nieprawidłowy adres e-mail lub hasło!";
        } else if (err?.code === "auth/invalid-email") {
          readableError = "Niepoprawny format adresu e-mail!";
        } else if (err?.code === "auth/weak-password") {
          readableError = "Hasło musi mieć co najmniej 6 znaków!";
        }
        setAuthError(readableError);
      }
    } finally {
      setSubmittingAuth(false);
    }
  };

  // 2e. Szybkie Logowanie jako Gość (Anonymous)
  const handleGuestSignIn = async () => {
    setAuthError("");
    setSubmittingAuth(true);
    try {
      const authResult = await signInAnonymously(auth);
      const user = authResult.user;
      if (user) {
        const { getDoc, doc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const profile = userDoc.data() as UserProfile;
          setCurrentUser(profile);
          localStorage.setItem("predictor_user_profile", JSON.stringify(profile));
          setActiveTab("matches");
        } else {
          // Trigger onboarding phase
          setUsername("");
          setCurrentUser(null);
        }
      }
    } catch (err: any) {
      console.error("Guest Auth Error: ", err);
      if (err?.code === "auth/admin-restricted-operation" || err?.message?.includes("admin-restricted-operation")) {
        setAuthError("firebase-guest-disabled");
      } else {
        setAuthError(`Błąd szybkiego logowania: ${err?.message || err}`);
      }
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleLocalSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setSubmittingAuth(true);
    
    if (username.trim().length < 2) {
      setAuthError("Nazwa gracza musi mieć co najmniej 2 znaki!");
      setSubmittingAuth(false);
      return;
    }

    const formattedUsername = username.trim();
    // Normalize username as alphanumeric string for Firestore Document ID
    const docId = formattedUsername.toLowerCase().replace(/[^a-z0-9_]/g, "");
    
    if (docId.length < 2) {
      setAuthError("Nazwa gracza musi zawierać odpowiednie znaki alfanumeryczne!");
      setSubmittingAuth(false);
      return;
    }

    try {
      const { getDoc, doc, setDoc } = await import('firebase/firestore');
      const userRef = doc(db, 'users', docId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const existingProfile = userSnap.data() as UserProfile;
        
        // Validate PIN
        const testPin = pin || "0000";
        const actualPin = existingProfile.pin || "0000";
        
        if (testPin !== actualPin) {
          setAuthError("Nieprawidłowy PIN dla tego gracza! Jeśli to nowa nazwa profilu, zmień ją.");
          setSubmittingAuth(false);
          return;
        }

        // Update avatar (and save back to Firestore)
        const updatedProfile = {
          ...existingProfile,
          avatarUrl: selectedAvatar,
        };
        await setDoc(userRef, updatedProfile);
        
        setCurrentUser(updatedProfile);
        setIsAuthenticated(true);
        localStorage.setItem("predictor_user_profile", JSON.stringify(updatedProfile));

        // Save to local device profiles for quick reuse
        const localUsersList = JSON.parse(localStorage.getItem("predictor_local_users") || "[]");
        const filteredUsers = localUsersList.filter((u: any) => u.uid !== docId);
        filteredUsers.push({
          uid: docId,
          username: formattedUsername,
          avatarUrl: selectedAvatar,
          pin: pin || "0000"
        });
        localStorage.setItem("predictor_local_users", JSON.stringify(filteredUsers));
        setLocalProfiles(filteredUsers);

        setActiveTab("matches");
      } else {
        // Create new cloud profile
        let verifyAdmin = false;
        if (adminCode.trim()) {
          if (adminCode.trim() === "2026" || adminCode.trim() === "mundial2026") {
            verifyAdmin = true;
          } else {
            setAuthError("Nieprawidłowy kod administratora!");
            setSubmittingAuth(false);
            return;
          }
        }

        const newProfile: UserProfile = {
          uid: docId,
          username: formattedUsername,
          avatarUrl: selectedAvatar,
          points: 0,
          isAdmin: verifyAdmin,
          pin: pin || "0000",
          createdAt: new Date().toISOString()
        };

        await setDoc(userRef, newProfile);
        
        setCurrentUser(newProfile);
        setIsAuthenticated(true);
        localStorage.setItem("predictor_user_profile", JSON.stringify(newProfile));

        // Save to local device profiles for quick reuse
        const localUsersListNew = JSON.parse(localStorage.getItem("predictor_local_users") || "[]");
        const filteredUsersNew = localUsersListNew.filter((u: any) => u.uid !== docId);
        filteredUsersNew.push({
          uid: docId,
          username: formattedUsername,
          avatarUrl: selectedAvatar,
          pin: pin || "0000"
        });
        localStorage.setItem("predictor_local_users", JSON.stringify(filteredUsersNew));
        setLocalProfiles(filteredUsersNew);

        setActiveTab("matches");
      }
    } catch (err: any) {
      console.error("Cloud PIN sign-in error: ", err);
      setAuthError("Błąd zapisu w chmurze: " + (err.message || String(err)));
    } finally {
      setSubmittingAuth(false);
    }
  };

  // 2b. Complete Profile Onboarding Handler (for first-time Google sign-ins)
  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    
    if (username.trim().length < 2) {
      setAuthError("Nazwa użytkownika musi mieć co najmniej 2 znaki!");
      return;
    }
    
    const formattedUsername = username.trim();

    if (isLocalMode) {
      try {
        setSubmittingAuth(true);
        const localUsers = JSON.parse(localStorage.getItem("predictor_local_users") || "[]");
        const isTaken = localUsers.some((u: any) => u.username.toLowerCase() === formattedUsername.toLowerCase());
        if (isTaken) {
          setAuthError("Ta nazwa użytkownika jest już zajęta w Waszej grupie!");
          return;
        }

        let verifyAdmin = false;
        if (adminCode.trim()) {
          if (adminCode.trim() === "2026" || adminCode.trim() === "mundial2026") {
            verifyAdmin = true;
          } else {
            setAuthError("Nieprawidłowy kod administratora!");
            return;
          }
        }

        const newUid = `local_${Date.now()}`;
        const newProfile: UserProfile = {
          uid: newUid,
          username: formattedUsername,
          avatarUrl: selectedAvatar,
          points: 0,
          isAdmin: verifyAdmin,
          pin: pin || "0000",
          createdAt: new Date().toISOString()
        };

        localUsers.push(newProfile);
        localStorage.setItem("predictor_local_users", JSON.stringify(localUsers));
        setCurrentUser(newProfile);
        setIsAuthenticated(true);
        localStorage.setItem("predictor_user_profile", JSON.stringify(newProfile));
        window.dispatchEvent(new Event("local_db_updated"));
        setActiveTab("matches");
      } catch (err: any) {
        setAuthError(`Nie udało się zapisać profilu: ${err?.message || err}`);
      } finally {
        setSubmittingAuth(false);
      }
      return;
    }

    const googleUser = auth.currentUser;
    if (!googleUser) {
      setAuthError("Brak aktywnej sesji użytkownika! Spróbuj zalogować się ponownie.");
      return;
    }
    
    try {
      setSubmittingAuth(true);
      
      // Fetch fresh users to prevent name collisions
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const dbUsers: UserProfile[] = [];
      usersSnapshot.forEach(doc => {
        dbUsers.push(doc.data() as UserProfile);
      });
      
      const isTaken = dbUsers.some(u => u.username.toLowerCase() === formattedUsername.toLowerCase());
      if (isTaken) {
        setAuthError("Ta nazwa użytkownika jest już zajęta w Waszej grupie!");
        return;
      }
      
      let verifyAdmin = false;
      if (adminCode.trim()) {
        if (adminCode.trim() === "2026" || adminCode.trim() === "mundial2026") {
          verifyAdmin = true;
        } else {
          setAuthError("Nieprawidłowy kod administratora!");
          return;
        }
      }
      
      const newProfile: UserProfile = {
        uid: googleUser.uid,
        username: formattedUsername,
        avatarUrl: selectedAvatar,
        points: 0,
        isAdmin: verifyAdmin,
        pin: pin || "0000",
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'users', googleUser.uid), newProfile);
      setCurrentUser(newProfile);
      localStorage.setItem("predictor_user_profile", JSON.stringify(newProfile));
      setActiveTab("matches");
    } catch (e: any) {
      console.error(e);
      setAuthError(`Nie udało się zapisać profilu: ${e?.message || e}`);
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem("predictor_user_profile");
    } catch (e) {
      console.error(e);
    }
  };

  // 3. User makes prediction
  const handleSavePrediction = async (matchId: string, predA: number, predB: number) => {
    if (!currentUser) return;

    const predictionId = `${currentUser.uid}_${matchId}`;
    const predictionPath = `predictions/${predictionId}`;

    // Find if user already has a prediction to preserve its createdAt timestamp
    const existingPred = predictions.find(p => p.id === predictionId);
    const createdAt = existingPred?.createdAt || new Date().toISOString();

    const newPrediction: Prediction = {
      id: predictionId,
      userId: currentUser.uid,
      username: currentUser.username,
      matchId,
      predictedA: predA,
      predictedB: predB,
      createdAt,
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'predictions', predictionId), newPrediction);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, predictionPath);
    }
  };

  // 4. Admin submits new match
  const handleAddMatch = async (matchFields: Omit<Match, "id">) => {
    const freshId = `match_${Date.now()}`;
    const writePath = `matches/${freshId}`;
    const freshMatch: Match = {
      id: freshId,
      ...matchFields
    };

    try {
      await setDoc(doc(db, 'matches', freshId), freshMatch);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, writePath);
    }
  };

  // 5. Admin updates match (score, status)
  const handleUpdateMatch = async (matchId: string, updatedFields: Partial<Match>) => {
    const updatePath = `matches/${matchId}`;
    try {
      await updateDoc(doc(db, 'matches', matchId), updatedFields);
      // Automatically recalculate scores to make point allocation instant!
      await handleRecalculateScores();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, updatePath);
    }
  };

  // Admin activation handler (for existing users entering the correct code)
  const handleActivateAdmin = async () => {
    if (!currentUser) return;
    const code = await customPrompt("Podaj kod administratora grupy:", "Wprowadź tajny klucz dostępu", "", "Aktywacja Organizatora");
    if (code === null) return;
    
    if (code.trim() === "2026" || code.trim() === "mundial2026") {
      try {
        const updatedProfile = {
          ...currentUser,
          isAdmin: true
        };
        await updateDoc(doc(db, 'users', currentUser.uid), { isAdmin: true });
        setCurrentUser(updatedProfile);
        localStorage.setItem("predictor_user_profile", JSON.stringify(updatedProfile));
        await customAlert("Pomyślnie aktywowano panel administratora! Możesz teraz zarządzać meczami.", "Sukces!");
        setActiveTab("admin");
      } catch (err: any) {
        console.error(err);
        await customAlert(`Błąd podczas aktywacji administratora: ${err.message || err}`, "Błąd");
      }
    } else {
      await customAlert("Nieprawidłowy kod administratora!", "Błąd");
    }
  };

  // 6. Admin deletes match
  const handleDeleteMatch = async (matchId: string) => {
    const deletePath = `matches/${matchId}`;
    try {
      await deleteDoc(doc(db, 'matches', matchId));
      
      // Also delete predictions related to this match
      const relatedPreds = predictions.filter(p => p.matchId === matchId);
      for (const p of relatedPreds) {
        await deleteDoc(doc(db, 'predictions', p.id));
      }
      
      // Automatically recalculate scores to update user standings
      await handleRecalculateScores();
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, deletePath);
    }
  };

  // 6b. Admin deletes user profile entirely
  const handleDeleteUser = async (userId: string) => {
    try {
      // 1. Delete user from Firestore
      await deleteDoc(doc(db, 'users', userId));
      
      // 2. Query and delete all predictions of this user
      const predsQuery = query(collection(db, 'predictions'), where('userId', '==', userId));
      const predsRef = await getDocs(predsQuery);
      for (const pDoc of predsRef.docs) {
        await deleteDoc(doc(db, 'predictions', pDoc.id));
      }
      
      // 3. Remove from local quick-select profile cache if inside
      const localUsers = JSON.parse(localStorage.getItem("predictor_local_users") || "[]");
      const filtered = localUsers.filter((lu: any) => lu.uid !== userId);
      localStorage.setItem("predictor_local_users", JSON.stringify(filtered));
      setLocalProfiles(filtered);

      // 4. If current user deleted themselves, sign out
      if (currentUser?.uid === userId) {
        setCurrentUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem("predictor_user_profile");
      }

      // 5. Automatically recalculate scores to update remaining user standings
      await handleRecalculateScores();
    } catch (err: any) {
      console.error("Failed to delete user profile entirely: ", err);
      throw err;
    }
  };

  // 7. Recount scores algorithm
  const handleRecalculateScores = async () => {
    try {
      // 1. Gather all current matches and predictions
      const matchesRef = await getDocs(collection(db, 'matches'));
      const activeMatches: Match[] = [];
      matchesRef.forEach(d => activeMatches.push(d.data() as Match));

      const predictionsRef = await getDocs(collection(db, 'predictions'));
      const activePredictions: Prediction[] = [];
      predictionsRef.forEach(d => activePredictions.push(d.data() as Prediction));

      const usersRef = await getDocs(collection(db, 'users'));
      const activeUsers: UserProfile[] = [];
      usersRef.forEach(d => activeUsers.push(d.data() as UserProfile));

      // 2. Clear score points on users locally to calculate fresh totals
      const pointsMap: { [userId: string]: number } = {};
      activeUsers.forEach(u => {
        pointsMap[u.uid] = 0;
      });

      // 3. For each prediction, evaluate outcome if corresponding match is finished
      for (const prediction of activePredictions) {
        const match = activeMatches.find(m => m.id === prediction.matchId);
        if (match && match.status === "finished" && match.scoreA !== undefined && match.scoreB !== undefined) {
          
          let scoreGained = 0;
          const predictedDiff = prediction.predictedA - prediction.predictedB;
          const actualDiff = match.scoreA - match.scoreB;

          // Perfect Match Score (e.g. predicted 2-1, ended 2-1)
          if (prediction.predictedA === match.scoreA && prediction.predictedB === match.scoreB) {
            scoreGained = 3;
          }
          // Correct outcome (e.g. Home win direction matched, Away win direction matched, Draw matched)
          else if (
            (predictedDiff > 0 && actualDiff > 0) || // Home team win
            (predictedDiff < 0 && actualDiff < 0) || // Away team win
            (predictedDiff === 0 && actualDiff === 0) // Draw
          ) {
            scoreGained = 1;
          } else {
            scoreGained = 0;
          }

          // Save pointsEarned on the prediction
          const predId = prediction.id;
          await updateDoc(doc(db, 'predictions', predId), { pointsEarned: scoreGained });

          // Accumulate for users profile
          if (pointsMap[prediction.userId] !== undefined) {
            pointsMap[prediction.userId] += scoreGained;
          }
        }
      }

      // 4. Update points for all modified users profiles
      for (const [userId, totalPts] of Object.entries(pointsMap)) {
        await updateDoc(doc(db, 'users', userId), { points: totalPts });
      }

    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  // Determine current user rank
  const sortedUsersList = [...users].sort((a, b) => b.points - a.points);
  const myRankNum = sortedUsersList.findIndex(u => u.uid === currentUser?.uid) + 1;
  const myRankText = myRankNum > 0 ? `#${myRankNum}` : "-";

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white antialiased">
      
      {/* Upper Navigation Header */}
      <header className="border-b border-slate-900 bg-[#020617]/85 backdrop-blur-md sticky top-0 z-40 px-4 py-3.5 sm:px-6 shadow-[0_4px_30px_rgba(2,6,23,0.5)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/25 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
              <Trophy className="w-5 h-5 shrink-0" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black text-slate-100 uppercase tracking-widest leading-none">CWEL <span className="text-indigo-400">LIGA</span></h1>
              {isLocalMode && (
                <span className="text-[8.5px] font-black tracking-widest bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md uppercase font-mono animate-pulse">Symulator ⚡</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Rules trigger button */}
            <button
              onClick={() => setShowRules(!showRules)}
              className="p-2.5 text-slate-400 hover:text-slate-100 rounded-xl hover:bg-slate-900/60 transition flex items-center gap-2 text-xs font-bold border border-slate-800/80 bg-slate-950/20 cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-indigo-400 font-bold" />
              <span className="hidden sm:inline">System Punktacji</span>
            </button>

            {/* Logout button */}
            {currentUser && (
              <div className="flex items-center gap-3 pl-3 border-l border-slate-800/80">
                <div className="hidden md:flex items-center gap-2">
                  <img 
                    src={currentUser.avatarUrl} 
                    alt={currentUser.username}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full border border-indigo-500/30 bg-slate-900"
                  />
                  <div className="text-left leading-none">
                    <span className="text-xs font-bold text-slate-200 block max-w-[120px] truncate">{currentUser.username}</span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 rounded-xl border border-rose-950/30 transition cursor-pointer"
                  title="Wyloguj się"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {loadingAuth ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_15px_rgba(99,102,241,0.2)]"></div>
            <p className="text-[10px] text-slate-500 font-extrabold font-mono tracking-widest uppercase">Łączenie ze stadionem...</p>
          </div>
        ) : !currentUser ? (
          /* SECTION: DISCORD LOGIN VIEW */
          <div className="max-w-md mx-auto py-8 animate-in fade-in slide-in-from-bottom-5 duration-300" id="auth-portal">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-[2.25rem] p-8 backdrop-blur-md shadow-[0_0_30px_rgba(30,58,138,0.25)] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 w-28 h-28 bg-gradient-to-br from-indigo-500/20 to-transparent blur-3xl rounded-full" />
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-slate-950 border border-slate-800 text-indigo-400 flex items-center justify-center rounded-2xl mx-auto mb-4 hover:rotate-6 transition duration-300 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                  <Gamepad2 className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-sans font-black italic tracking-tighter uppercase text-slate-100">
                  MUNDIAL <span className="text-indigo-400">TYPER</span>
                </h2>
                <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto leading-relaxed">
                  Zaloguj się kontem Google, typuj mecze na żywo i zbieraj punkty za poprawne wyniki ze znajomymi!
                </p>
              </div>

              {authError && (
                authError === "firebase-email-disabled" ? (
                  <div className="mb-5 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-xs leading-relaxed space-y-3 animate-in fade-in duration-200">
                    <div className="flex gap-2.5 items-center font-bold text-amber-400 border-b border-amber-500/15 pb-2">
                      <ShieldAlert className="w-5 h-5 shrink-0" />
                      <span className="uppercase tracking-wider font-mono text-[10px]">Logowanie E-mail jest wyłączone!</span>
                    </div>
                    <p className="text-[11px] text-slate-350">
                      Błąd <code className="font-mono bg-slate-950 px-1 py-0.5 rounded text-amber-400 text-[10px]">auth/operation-not-allowed</code> oznacza, że dostawca logowania przez E-mail/Hasło nie jest włączony w konsoli Firebase!
                    </p>
                    <div className="bg-slate-950/80 p-3 rounded-xl space-y-1.5 border border-slate-800 text-[10.5px] text-slate-400">
                      <p className="font-extrabold text-slate-300 text-[9px] uppercase tracking-wider font-mono">Jak to włączyć w 20 sekund:</p>
                      <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                        <li>Wejdź na stronę <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline font-bold">Firebase Console</a>.</li>
                        <li>Wybierz swój projekt, a następnie przejdź do <strong className="text-slate-250">Authentication</strong> w menu po lewej stronie.</li>
                        <li>Kliknij zakładkę <strong className="text-slate-250">Sign-in method</strong> na górze ekranu.</li>
                        <li>Kliknij przycisk <strong className="text-indigo-400 font-bold">Add new provider</strong> (Dodaj nowego dostawcę).</li>
                        <li>Wybierz <strong className="text-slate-250">Email/Password</strong> (E-mail i hasło), włącz pierwszy suwak i kliknij <strong className="text-indigo-400">Save</strong>.</li>
                      </ol>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAuthError("")}
                      className="w-full py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition cursor-pointer border border-amber-500/20"
                    >
                      Rozumiem, zamknij i spróbuj ponownie
                    </button>
                  </div>
                ) : authError === "firebase-guest-disabled" ? (
                  <div className="mb-5 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-xs leading-relaxed space-y-3 animate-in fade-in duration-200">
                    <div className="flex gap-2.5 items-center font-bold text-amber-400 border-b border-amber-500/15 pb-2">
                      <ShieldAlert className="w-5 h-5 shrink-0" />
                      <span className="uppercase tracking-wider font-mono text-[10px]">Logowanie Gościa jest wyłączone!</span>
                    </div>
                    <p className="text-[11px] text-slate-350">
                      Błąd <code className="font-mono bg-slate-950 px-1 py-0.5 rounded text-amber-400 text-[10px]">auth/admin-restricted-operation</code> oznacza, że logowanie anonimowe nie zostało włączone w konsoli Firebase!
                    </p>
                    <div className="bg-slate-950/80 p-3 rounded-xl space-y-1.5 border border-slate-800 text-[10.5px] text-slate-400">
                      <p className="font-extrabold text-slate-300 text-[9px] uppercase tracking-wider font-mono">Jak to włączyć w 20 sekund:</p>
                      <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                        <li>Wejdź na stronę <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline font-bold">Firebase Console</a>.</li>
                        <li>Wybierz swój projekt, a następnie przejdź do <strong className="text-slate-250">Authentication</strong> w menu po lewej stronie.</li>
                        <li>Kliknij zakładkę <strong className="text-slate-250">Sign-in method</strong> na górze ekranu.</li>
                        <li>Kliknij przycisk <strong className="text-indigo-400 font-bold">Add new provider</strong> (Dodaj nowego dostawcę).</li>
                        <li>Wybierz <strong className="text-slate-250">Anonymous</strong> (Anonimowe), włącz suwak i kliknij <strong className="text-indigo-400">Save</strong>.</li>
                      </ol>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAuthError("")}
                      className="w-full py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition cursor-pointer border border-amber-500/20"
                    >
                      Rozumiem, zamknij i spróbuj ponownie
                    </button>
                  </div>
                ) : (
                  <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex gap-2.5 items-start font-medium select-none animate-in fade-in duration-200">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )
              )}

              {!isAuthenticated ? (
                /* EXCLUSIVE LOCAL USER LOG IN */
                <div className="space-y-5 animate-in fade-in duration-300">
                  <form onSubmit={handleLocalSignIn} className="space-y-4 animate-in fade-in duration-250">
                    <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-[11px] text-emerald-350 leading-relaxed font-sans">
                      <p className="font-extrabold text-emerald-400 text-[10px] uppercase tracking-wider font-mono mb-1">⚡ Panel Gracza Ligi Typera</p>
                      Wybierz istniejący profil poniżej lub stwórz zupełnie nowy, aby natychmiast typować mecze! Wszystkie dane i punktacja zapisują się automatycznie w Twojej przeglądarce.
                    </div>

                    {localProfiles.length > 0 && (
                      <div className="space-y-2 p-3 bg-slate-950 border border-slate-805 rounded-xl">
                        <p className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest font-mono">Dostępne profile na tym urządzeniu (X aby zapomnieć):</p>
                        <div className="flex flex-wrap gap-1.5">
                          {localProfiles.map((u: any) => (
                            <div key={u.uid} className="flex items-center bg-slate-900 border border-slate-800 rounded-lg pr-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setUsername(u.username);
                                  setPin(u.pin || "0000");
                                  setSelectedAvatar(u.avatarUrl);
                                }}
                                className={`pl-2.5 py-1 text-[10.5px] text-slate-300 flex items-center gap-1.5 cursor-pointer max-w-[125px] truncate rounded-l-lg transition ${
                                  username.toLowerCase() === u.username.toLowerCase()
                                    ? 'bg-emerald-600/30 text-emerald-300'
                                    : 'hover:text-white hover:bg-slate-800'
                                }`}
                                title={u.username}
                              >
                                <img src={u.avatarUrl} className="w-4 h-4 rounded-full inline" referrerPolicy="no-referrer" />
                                <span className="truncate">{u.username}</span>
                              </button>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const confirmForget = await customConfirm(
                                    `Czy na pewno chcesz usunąć profil "${u.username}" z listy szybkiego wyboru na tym urządzeniu? Nie spowoduje to usunięcia konta w bazie danych chmury.`,
                                    "Zniknij profil"
                                  );
                                  if (confirmForget) {
                                    const updated = localProfiles.filter((lu: any) => lu.uid !== u.uid);
                                    localStorage.setItem("predictor_local_users", JSON.stringify(updated));
                                    setLocalProfiles(updated);
                                  }
                                }}
                                className="p-1 hover:text-red-400 text-slate-500 rounded transition cursor-pointer shrink-0"
                                title="Usuń profil z tego urządzenia"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">
                        Nazwa gracza / Pseudonim
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="np. Szymek, Kowal, Tomek"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-slate-950/80 border-2 border-slate-800 rounded-2xl py-3 px-4 text-slate-100 text-sm focus:outline-hidden focus:border-emerald-505 font-semibold transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">
                        PIN zabezpieczający Twój profil (np. 0005)
                      </label>
                      <input
                        type="password"
                        placeholder="np. 0000"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        className="w-full bg-slate-950/80 border-2 border-slate-800 rounded-2xl py-3 px-4 text-slate-100 text-sm focus:outline-hidden focus:border-emerald-505 font-semibold transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">
                        Kod administratora (opcjonalny)
                      </label>
                      <input
                        type="password"
                        placeholder="Zostaw puste lub wpisz tajny kod"
                        value={adminCode}
                        onChange={(e) => setAdminCode(e.target.value)}
                        className="w-full bg-slate-950/80 border-2 border-slate-800 rounded-2xl py-3 px-4 text-slate-100 text-sm focus:outline-hidden focus:border-emerald-500 font-semibold transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">
                        Wybierz avatar
                      </label>
                      <div className="grid grid-cols-6 gap-2 pt-1">
                        {DISCORD_AVATARS.map((av, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedAvatar(av)}
                            className={`p-1 rounded-xl transition border-2 ${
                              selectedAvatar === av ? 'border-emerald-500 scale-105 bg-emerald-950/20' : 'border-transparent hover:border-slate-850'
                            }`}
                          >
                            <img src={av} className="w-full aspect-square rounded-lg object-cover" referrerPolicy="no-referrer" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submittingAuth}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-850 text-white font-extrabold uppercase tracking-widest text-xs rounded-2xl shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer font-sans"
                    >
                      {submittingAuth ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <Gamepad2 className="w-4 h-4 animate-pulse" />
                          <span>WEJDŹ DO GRY ⚡</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                /* PROFILE ONBOARDING FOR NEW USERS */
                <form onSubmit={handleOnboardingSubmit} className="space-y-5 animate-in fade-in duration-300">
                  <div className="p-3 bg-indigo-500/15 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300 leading-relaxed animate-pulse">
                    🎉 Połączono pomyślnie! Teraz utwórz swój profil w Lidze Typera, by pozostali gracze widzieli Twoje typy.
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-indigo-300 uppercase tracking-widest mb-1.5 font-mono">
                      Nazwa użytkownika Discord / Pseudonim
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm font-black">@</span>
                      <input
                        type="text"
                        required
                        placeholder="np. Szymek, Kowal"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-slate-950/80 border-2 border-slate-800 rounded-2xl py-3 pl-8 pr-4 text-slate-100 text-sm focus:outline-hidden focus:border-indigo-500 font-semibold transition"
                      />
                    </div>
                  </div>

                  {/* Register Avatars List */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-indigo-300 uppercase tracking-widest mb-2 font-mono">
                      Wybierz swój kolor awataru Discord
                    </label>
                    <div className="grid grid-cols-6 gap-2 bg-slate-950/60 p-2 rounded-2xl border border-slate-800">
                      {DISCORD_AVATARS.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedAvatar(url)}
                          className={`relative rounded-full overflow-hidden border-2 aspect-square p-0.5 bg-slate-900 transition-all ${
                            selectedAvatar === url ? "border-indigo-500 scale-110 shadow-[0_0_10px_rgba(99,102,241,0.5)]" : "border-transparent hover:border-slate-700"
                          }`}
                        >
                          <img 
                            src={url} 
                            alt={`avatar-${idx}`} 
                            className="w-full h-full rounded-full shrink-0" 
                            referrerPolicy="no-referrer"
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Admin trigger key inside onboarding */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-indigo-300 uppercase tracking-widest mb-1.5 font-mono flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Jesteś organizatorem ligi?
                    </label>
                    <input
                      type="password"
                      placeholder="Kod administratora grupy (zostaw puste dla zwykłego gracza)"
                      value={adminCode}
                      onChange={(e) => setAdminCode(e.target.value)}
                      className="w-full bg-slate-950/80 border-2 border-slate-800 rounded-2xl px-4 py-2.5 text-slate-300 text-xs focus:outline-hidden focus:border-indigo-500 font-semibold"
                    />
                    <span className="text-[9px] text-slate-500 mt-1 block">
                      Pozwala wprowadzać oficjalne wyniki meczów podając tajny kod organizatora.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingAuth}
                    className="w-full py-4 mt-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black uppercase tracking-widest rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] transition-all transform active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4 shrink-0" />
                    {submittingAuth ? "ZAPISYWANIE..." : "DOKOŃCZ REJESTRACJĘ"}
                  </button>

                  <div className="text-center mt-4 pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="text-slate-500 hover:text-slate-400 text-[10px] font-bold uppercase tracking-wider underline cursor-pointer"
                    >
                      Wyloguj się / Zmień konto Google
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : (
          /* SECTION: APPLICATION CLIENT WORKSPACE */
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Immersive Top Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Profile Card */}
              <div className="md:col-span-1 bg-slate-900/50 border border-slate-800/85 rounded-3xl p-5 backdrop-blur-md shadow-[0_0_25px_rgba(30,58,138,0.15)] flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-2xl rounded-full" />
                
                <div className="flex items-center gap-4 mb-4 z-10">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center border-2 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] overflow-hidden">
                      {currentUser.avatarUrl ? (
                        <img 
                          src={currentUser.avatarUrl} 
                          alt={currentUser.username} 
                          className="w-full h-full object-cover rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="font-bold text-xl">{currentUser.username.substring(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full"></div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight text-slate-100">{currentUser.username}</h3>
                    <p className="text-[10px] text-indigo-300 uppercase tracking-widest font-semibold flex items-center gap-1 mt-0.5 font-mono">
                      {currentUser.isAdmin ? "👑 Organizator" : "Gracz Ligi"}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-center z-10">
                  <div className="bg-slate-800/50 border border-slate-800/60 rounded-xl py-2.5 shadow-inner">
                    <p className="text-[9px] uppercase tracking-widest opacity-60 text-slate-400 font-mono">Punkty</p>
                    <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">{currentUser.points}</p>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-800/60 rounded-xl py-2.5 shadow-inner">
                    <p className="text-[9px] uppercase tracking-widest opacity-60 text-slate-400 font-mono">Miejsce</p>
                    <p className="text-2xl font-black text-amber-400 font-mono mt-0.5">{myRankText}</p>
                  </div>
                </div>
              </div>

              {/* Main Content Info Header */}
              <header className="md:col-span-2 flex flex-col justify-between bg-gradient-to-br from-indigo-950/40 via-slate-900/40 to-[#020617]/90 p-6 rounded-3xl border border-indigo-500/20 shadow-[0_0_30px_rgba(79,70,229,0.08)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-3xl rounded-full" />
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 w-full">
                  <div>
                    <h1 className="text-3xl font-sans font-black italic tracking-tighter uppercase leading-none">
                      Mundial <span className="text-indigo-400">Typer</span>
                    </h1>
                    <p className="text-slate-400 text-xs mt-2 max-w-md leading-relaxed">
                      Wytypuj poprawne wyniki spotkań turnieju!
                    </p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-[10px] uppercase opacity-50 tracking-widest font-mono font-bold">NASTĘPNY GWIZDEK ZA:</p>
                    <div className="font-mono text-2xl font-extrabold text-indigo-400 tracking-wider mt-1 drop-shadow-[0_0_10px_rgba(129,140,248,0.35)] min-w-[124px]">
                      {countdownText}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 items-center text-[10px] text-slate-500 font-mono pt-4 border-t border-slate-800/40 mt-4 z-10">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500 shadow-sm shadow-emerald-500/20"></span> Dokładny wynik (+3 pkt)</div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-sky-500 shadow-sm shadow-sky-500/20"></span> Rezultat zwycięzcy (+1 pkt)</div>
                </div>
              </header>

            </div>

            {/* Display Scoring Rules Card if toggled */}
            {showRules && (
              <div className="animate-in slide-in-from-top-4 duration-300">
                <RulesInfo />
              </div>
            )}

            {/* Navigation Tabs (Terminarz & Typowanie vs Tabela Standings vs Admin) */}
            <div className="flex flex-col sm:flex-row p-1.5 gap-2 bg-slate-900/60 border border-slate-800/80 rounded-2xl backdrop-blur-md shadow-lg sm:items-center sm:justify-between">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setActiveTab("matches")}
                  className={`py-3 px-6 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                    activeTab === "matches"
                      ? "bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  Mecze i Twoje Typy ({matches.length})
                </button>
                <button
                  onClick={() => setActiveTab("standings")}
                  className={`py-3 px-6 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                    activeTab === "standings"
                      ? "bg-indigo-650 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  Tabela Wyników ({users.length})
                </button>
                
                {currentUser.isAdmin && (
                  <button
                    onClick={() => setActiveTab("admin")}
                    className={`py-3 px-6 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === "admin"
                        ? "bg-amber-600 text-white shadow-[0_0_20px_rgba(217,119,6,0.4)]"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                    }`}
                  >
                    <Settings className="w-4 h-4 shrink-0" />
                    panel admina
                  </button>
                )}
              </div>

              {!currentUser.isAdmin && (
                <button
                  onClick={handleActivateAdmin}
                  className="py-2.5 px-4 text-[10px] font-black uppercase tracking-wider text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-400/40 rounded-xl transition duration-250 cursor-pointer flex items-center justify-center gap-1.5 self-start sm:self-auto"
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  Zostań organizatorem
                </button>
              )}
            </div>

            {/* Active view component */}
            <div className="space-y-6">
              {activeTab === "matches" && (
                <MatchList 
                  matches={matches}
                  predictions={predictions.filter(p => p.userId === currentUser.uid)}
                  currentUserId={currentUser.uid}
                  onSavePrediction={handleSavePrediction}
                  customAlert={customAlert}
                />
              )}

              {activeTab === "standings" && (
                <Leaderboard 
                  users={users}
                  matches={matches}
                  predictions={predictions}
                  currentUserId={currentUser.uid}
                />
              )}

              {activeTab === "admin" && currentUser.isAdmin && (
                <AdminPanel 
                  matches={matches}
                  predictions={predictions}
                  users={users}
                  onAddMatch={handleAddMatch}
                  onUpdateMatch={handleUpdateMatch}
                  onDeleteMatch={handleDeleteMatch}
                  onDeleteUser={handleDeleteUser}
                  onRecalculateScores={handleRecalculateScores}
                  customAlert={customAlert}
                  customConfirm={customConfirm}
                />
              )}
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-slate-900 bg-slate-950/80 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-bold tracking-wide">Aplikacja Typowania Mundialu dla Paczki Znajomych</p>
          <p className="mt-1 text-[10px] opacity-60">Zasilane przez Google AI Studio Build & Firebase Realtime</p>
        </div>
      </footer>

      {/* Elegant Translucent Dynamic Dialog System Modal Option */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800/80 rounded-[2.25rem] p-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full" />
            
            <div className="flex items-center gap-3.5 mb-4 pb-3 border-b border-slate-800/60">
              <div className={`p-2.5 rounded-xl border ${
                modal.type === 'confirm' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_15px_rgba(217,119,6,0.1)]' : 
                modal.type === 'prompt' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20 shadow-[0_0_15px_rgba(79,70,229,0.1)]' : 
                'bg-indigo-500/10 text-indigo-500 border-indigo-500/20 shadow-[0_0_15px_rgba(79,70,229,0.1)]'
              }`}>
                {modal.type === 'confirm' ? <ShieldAlert className="w-5 h-5 shrink-0" /> : <ShieldCheck className="w-5 h-5 shrink-0" />}
              </div>
              <h3 className="text-sm font-black tracking-tight text-slate-100 uppercase">{modal.title}</h3>
            </div>

            <p className="text-slate-300 text-xs mb-6 font-semibold leading-relaxed whitespace-pre-line">{modal.message}</p>

            {modal.type === 'prompt' && (
              <div className="mb-6">
                <input
                  type="text"
                  placeholder={modal.placeholder || "Podaj wartość..."}
                  value={modal.value || ""}
                  onChange={(e) => setModal(prev => ({ ...prev, value: e.target.value }))}
                  className="w-full bg-slate-950/80 border-2 border-slate-800 rounded-2xl px-4 py-3 text-slate-250 text-xs focus:outline-hidden focus:border-indigo-500 font-bold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      modal.onResolve?.(modal.value);
                    }
                  }}
                />
              </div>
            )}

            <div className="flex gap-3 justify-end items-center">
              {modal.type !== 'alert' && (
                <button
                  onClick={() => modal.onResolve?.(modal.type === 'prompt' ? null : false)}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-750 border border-slate-750 hover:border-slate-705 text-slate-400 hover:text-slate-200 font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition cursor-pointer"
                >
                  Anuluj
                </button>
              )}
              <button
                onClick={() => modal.onResolve?.(modal.type === 'prompt' ? modal.value : true)}
                className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition cursor-pointer duration-200 ${
                  modal.type === 'confirm'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]'
                }`}
              >
                {modal.type === 'confirm' ? 'Tak, potwierdzam' : 'Zatwierdź'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
