import { Redirect } from "expo-router";
import { useSelector } from "react-redux";
import { RootState } from "../store";

export default function Index() {
  const isUnlocked = useSelector((state: RootState) => state.biometrics.unlocked);
  const passwordSet = useSelector((state: RootState) => state.biometrics.passwordSet);

  // No password set → force password setup
  if (!passwordSet) {
    return <Redirect href="/(wallet)/setup/set-password" />;
  }

  // Password set but locked → unlock screen
  if (!isUnlocked) {
    return <Redirect href="/(wallet)/unlock" />;
  }

  // All good → dashboard
  return <Redirect href="/(app)" />;
}
