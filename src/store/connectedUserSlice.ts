import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import apiRepository, { setAccessToken } from "../api";

export interface AsyncState<T = any> {
  data: T;
  loading: boolean;
  error: string | null;
  success: boolean | null;
}

export interface ConnectedUserState {
  connectedUserType: AsyncState<string>;
  registerUser: AsyncState<any>;
  loginUser: AsyncState<any>;
}

export const fetchConnectedUser = createAsyncThunk(
  "connectedUser/fetchConnectedUser",
  async (userId: string, { rejectWithValue }) => {
    try {
      const params = {
        org: "Org1MSP",
        userId: userId,
      };

      const response = await apiRepository.get("/user/user-type", params, false);
      console.log("connectedAccountUserType Data:", response.data?.toString());
      return response.data?.toString() ?? "";
    } catch (error: any) {
      console.log("fetchConnectedUser error:", error.message || error);
      return rejectWithValue(error.message || String(error));
    }
  }
);

export const registerNewUser = createAsyncThunk(
  "connectedUser/registerNewUser",
  async ({ userId, secret }: { userId: string; secret: string }, { rejectWithValue }) => {
    try {
      const bodyData = {
        org: "Org1MSP",
        userId: userId,
        secret: secret,
        encryptionKey: "your-encryption-key",
      };
      const response = await apiRepository.post("/user/register", bodyData, false);
      console.log("registerUser Created:", response.data);
      return response.data;
    } catch (error: any) {
      console.log("registerNewUser error:", error.message || error);
      return rejectWithValue(error.message || String(error));
    }
  }
);

export const LoginUser = createAsyncThunk(
  "connectedUser/LoginUser",
  async ({ userId, secret }: { userId: string; secret: string }, { rejectWithValue }) => {
    try {
      const bodyData = {
        secret: secret,
        userId: userId,
      };
      console.log("bodyData", bodyData);
      const response = await apiRepository.post("/user/login-user", bodyData, false);
      console.log("LoginUser Success:", response.data);
      if (typeof response.data === "string") {
        await setAccessToken(response.data);
      } else if (response.data?.token || response.data?.accessToken) {
        await setAccessToken(response.data.token || response.data.accessToken);
      }
      return response.data;
    } catch (error: any) {
      console.log("LoginUser error:", error.message || error);
      return rejectWithValue(error.message || String(error));
    }
  }
);

const initialState: ConnectedUserState = {
  connectedUserType: {
    data: "no wallet",
    loading: false,
    error: null,
    success: null,
  },
  registerUser: {
    data: null,
    loading: false,
    error: null,
    success: null,
  },
  loginUser: {
    data: null,
    loading: false,
    error: null,
    success: null,
  },
};

const connectedUserSlice = createSlice({
  name: "connectedUser",
  initialState,
  reducers: {
    resetConnectedUserState: (state) => {
      state.connectedUserType = initialState.connectedUserType;
      state.registerUser = initialState.registerUser;
      state.loginUser = initialState.loginUser;
    },
  },
  extraReducers: (builder) => {
    // fetchConnectedUser
    builder.addCase(fetchConnectedUser.pending, (state) => {
      state.connectedUserType.loading = true;
      state.connectedUserType.error = null;
      state.connectedUserType.success = null;
    });
    builder.addCase(fetchConnectedUser.fulfilled, (state, action: PayloadAction<string>) => {
      state.connectedUserType.loading = false;
      state.connectedUserType.data = action.payload;
      state.connectedUserType.success = true;
    });
    builder.addCase(fetchConnectedUser.rejected, (state, action) => {
      state.connectedUserType.loading = false;
      state.connectedUserType.error = (action.payload as string) || action.error.message || "Failed to fetch user type";
      state.connectedUserType.success = false;
    });

    // registerNewUser
    builder.addCase(registerNewUser.pending, (state) => {
      state.registerUser.loading = true;
      state.registerUser.error = null;
      state.registerUser.success = null;
    });
    builder.addCase(registerNewUser.fulfilled, (state, action) => {
      state.registerUser.loading = false;
      state.registerUser.data = action.payload;
      state.registerUser.success = true;
    });
    builder.addCase(registerNewUser.rejected, (state, action) => {
      state.registerUser.loading = false;
      state.registerUser.error = (action.payload as string) || action.error.message || "Failed to register user";
      state.registerUser.success = false;
    });

    // LoginUser
    builder.addCase(LoginUser.pending, (state) => {
      state.loginUser.loading = true;
      state.loginUser.error = null;
      state.loginUser.success = null;
    });
    builder.addCase(LoginUser.fulfilled, (state, action) => {
      state.loginUser.loading = false;
      state.loginUser.data = action.payload;
      state.loginUser.success = true;
    });
    builder.addCase(LoginUser.rejected, (state, action) => {
      state.loginUser.loading = false;
      state.loginUser.error = (action.payload as string) || action.error.message || "Failed to login user";
      state.loginUser.success = false;
    });
  },
});

export const { resetConnectedUserState } = connectedUserSlice.actions;
export default connectedUserSlice.reducer;
