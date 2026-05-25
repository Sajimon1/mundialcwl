export interface UserProfile {
  uid: string;
  username: string;
  avatarUrl: string;
  points: number;
  isAdmin: boolean;
  pin?: string; // Optional simple PIN for login
  createdAt: string;
}

export interface Match {
  id: string;
  teamA: string;
  teamB: string;
  group: string;
  date: string; // ISO string
  status: "scheduled" | "live" | "finished";
  scoreA?: number;
  scoreB?: number;
}

export interface Prediction {
  id: string; // userId_matchId
  userId: string;
  username: string;
  matchId: string;
  predictedA: number;
  predictedB: number;
  pointsEarned?: number;
  createdAt?: string;
  updatedAt?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}
