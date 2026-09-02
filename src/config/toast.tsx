import { BaseToast } from "react-native-toast-message";

export const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{ backgroundColor: "#3772FF" }}
      contentContainerStyle={{
        paddingHorizontal: 15,
      }}
      text1Style={{
        fontSize: 14,
        color: "#FFFFFF",
      }}
      text2Style={{
        color: "rgba(255, 255, 255, 0.8)",
      }}
    />
  ),
};
