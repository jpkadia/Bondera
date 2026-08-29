import { USERNAME_PATTERN, USERNAME_REQUIREMENTS } from "../constants/auth";
import { parseBirthDateText } from "./birth-date";

export interface LoginValues {
  identifier: string;
  password: string;
}

export interface SignupValues {
  fullName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  birthDateText: string;
}

export type LoginErrors = Partial<Record<keyof LoginValues, string>>;
export type SignupErrors = Partial<Record<keyof SignupValues | "otp", string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const validateLoginValues = (values: LoginValues): LoginErrors => {
  const errors: LoginErrors = {};
  const identifier = values.identifier.trim().replace(/^@/, "");

  if (!identifier) {
    errors.identifier = "Email or username is required.";
  } else if (identifier.length < 3) {
    errors.identifier = "Enter at least 3 characters.";
  } else if (identifier.length > 254) {
    errors.identifier = "Email or username is too long.";
  } else if (identifier.includes("@") && !emailPattern.test(identifier)) {
    errors.identifier = "Enter a valid email address.";
  } else if (!identifier.includes("@") && !USERNAME_PATTERN.test(identifier)) {
    errors.identifier = "Enter a valid email address or username.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length > 128) {
    errors.password = "Password cannot exceed 128 characters.";
  }

  return errors;
};

export const validateSignupValues = (values: SignupValues): SignupErrors => {
  const errors: SignupErrors = {};
  const fullName = values.fullName?.trim() ?? "";
  const username = values.username.trim();
  const email = values.email.trim().toLowerCase();

  if (!fullName) {
    errors.fullName = "Full name is required.";
  } else if (fullName.length > 80) {
    errors.fullName = "Full name cannot exceed 80 characters.";
  }
  if (!username) {
    errors.username = "Username is required.";
  } else if (!USERNAME_PATTERN.test(username)) {
    errors.username = USERNAME_REQUIREMENTS;
  }
  if (!email) {
    errors.email = "Email address is required.";
  } else if (email.length > 254 || !emailPattern.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!values.birthDateText) {
    errors.birthDateText = "Birthdate is required.";
  } else if (!parseBirthDateText(values.birthDateText)) {
    errors.birthDateText = "Enter a valid past birthdate in DD/MM/YYYY format.";
  }
  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length > 128) {
    errors.password = "Password cannot exceed 128 characters.";
  } else if (values.password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  } else if (!/[A-Z]/.test(values.password)) {
    errors.password = "Add at least one uppercase letter.";
  } else if (!/\d/.test(values.password)) {
    errors.password = "Add at least one number.";
  } else if (!/[^A-Za-z0-9]/.test(values.password)) {
    errors.password = "Add at least one special character.";
  }
  if (!values.confirmPassword) {
    errors.confirmPassword = "Confirm your password.";
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
};

export const validateOtp = (otp: string): string | undefined =>
  /^\d{6}$/.test(otp) ? undefined : "Enter the complete 6-digit OTP.";
