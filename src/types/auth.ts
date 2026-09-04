export interface LoginPayload {
  identifier: string; // Phone or Email or Username
  password: string;
}

export interface AuthSessionPayload {
  userId: string;
  role: 'Leader' | 'Member' | 'Admin';
  fullName: string;
}