import { BaseToast } from "react-native-toast-message";

export const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{ backgroundColor: "#F0B90B" }}
      contentContainerStyle={{
        paddingHorizontal: 15,
      }}
      text1Style={{
        fontSize: 14,
        color: "#0B0E14",
      }}
      text2Style={{
        color: "#0B0E14",
      }}
    />
  ),
};
