// The list of screens and what each one needs when it opens (used for type-safe navigation).

export type SignedOutStackParams = {
  Login: undefined;
  SignUp: undefined;
  CheckEmail: { email: string };
  ForgotPassword: undefined;
};

export type SignedInStackParams = {
  Home: undefined;
  Players: undefined;
  // "players" pre-fills the list (used by "Make as new").
  CreateTournament: { players?: string[] } | undefined;
  Tournament: { id: string };
  Settings: undefined;
  DeleteAccount: undefined;
};
