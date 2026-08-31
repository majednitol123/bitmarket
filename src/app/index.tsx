import { Redirect } from "expo-router";
import { useSelector } from "react-redux";
import { RootState } from "../store";

export default function Index() {
  const isUnlocked = useSelector((state: RootState) => state.biometrics.unlocked);
  const passwordSet = useSelector((state: RootState) => state.biometrics.passwordSet);
  const ethAddresses = useSelector((state: RootState) => state.ethereum.globalAddresses);
  
  const hasWallet = ethAddresses && ethAddresses.length > 0;

  // No wallet → setup flow
  if (!hasWallet) {
    return <Redirect href="/(wallet)/setup/wallet-setup" />;
  }

  // Wallet exists but no password set → force password setup (legacy migration)
  if (!passwordSet) {
    return <Redirect href="/(wallet)/setup/set-password" />;
  }

  // Wallet + password exist but locked → unlock screen
  if (!isUnlocked) {
    return <Redirect href="/(wallet)/unlock" />;
  }

  // All good → dashboard
  return <Redirect href="/(app)" />;
}
