import AsyncStorage from "@react-native-async-storage/async-storage";

// Function to set the access token
export const setAccessToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem("accessToken", token);
    console.log("Token saved successfully");
  } catch (error) {
    console.error("Error saving token", error);
  }
};

// Function to get the access token
export const getAccessToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem("accessToken");
    if (token !== null) {
      console.log("Token retrieved successfully", token);
      return token;
    }
    console.log("No token found");
    return null;
  } catch (error) {
    console.error("Error retrieving token", error);
    return null;
  }
};

// Function to remove the access token
export const removeAccessToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem("accessToken");
    console.log("Token removed successfully");
  } catch (error) {
    console.error("Error removing token", error);
  }
};
