export interface GoogleAuthButtonProps {
  disabled?: boolean;
  onCredential(idToken: string): void | Promise<void>;
  onError(message: string): void;
}
