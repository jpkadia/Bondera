export interface GoogleCredential {
  idToken: string;
}

export interface GoogleAuthButtonProps {
  disabled?: boolean;
  onCredential(credential: GoogleCredential): void | Promise<void>;
  onError(message: string): void;
}
