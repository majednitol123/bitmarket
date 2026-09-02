export interface Routes {
  home: string;
  unlock: string;
  setPassword: string;
  walletSetup: string;
  walletCreatedSuccessfully: string;
  biometrics: string;
  forgotPassword: string;
  settings: string;
  camera: string;
  portfolio: string;
}

export const ROUTES: Routes = {
  home: "/(app)",
  unlock: "/(wallet)/unlock",
  setPassword: "/(wallet)/setup/set-password",
  walletSetup: "/(wallet)/setup/set-password",
  walletCreatedSuccessfully: "/(wallet)/setup/wallet-created-successfully",
  biometrics: "/(wallet)/biometrics",
  forgotPassword: "/(wallet)/forgot-password",
  settings: "/(app)/settings/settings-modal",
  camera: "/(app)/camera",
  portfolio: "/(app)/portfolio",
};
