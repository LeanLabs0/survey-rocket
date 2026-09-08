export function publicAuthMessage(message: string) {
  if (/fetch failed|failed to fetch|networkerror|enotfound/i.test(message)) {
    return "Could not reach sign-in. Try again in a moment.";
  }
  if (/invalid login|invalid credentials/i.test(message)) {
    return "That email or password is not right.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Confirm this email first, or use the setup link we sent.";
  }
  return message;
}

export function passwordSetupPath() {
  return "/auth/set-password";
}
