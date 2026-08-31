# Custom Wallet (Multi-Chain Crypto Wallet)

A secure **multi-chain mobile wallet** built with **React Native (Expo)** that supports **Ethereum (EVM)** and **Solana**.  
Includes wallet setup/import, biometric unlock, auto-lock security, multi-account management, and **send/receive for native coins + ERC-20 + SPL tokens + NFTs**.

---

##  Key Features

###  Security
- **Biometric unlock** (FaceID / TouchID) using Expo Local Authentication
- **Password unlock** fallback
- **Auto-lock** after inactivity timeout (configurable)
- Persisted lock state using AsyncStorage + Redux Persist

### 🧩 Wallet Core
- Create / Import wallet (seed phrase)
- Seed phrase confirmation flow
- Multi-account support (EVM + Solana)
- Token list & token details screens

###  Transfers
- **Send / Receive**
  - **Ethereum native** (ETH)
  - **ERC-20 tokens**
  - **Solana native** (SOL)
  - **SPL tokens**
  - **NFTs (EVM + Solana supported by UI/flow)**

###  UX
- Expo Router navigation
- Clean theme system + gradient background
- Toast notifications
- Sentry error tracking integration

---

## 🛠 Tech Stack
- **React Native (Expo) + TypeScript**
- **Redux Toolkit + Redux Persist**
- Expo Router
- Expo Local Authentication
- AsyncStorage
- Styled Components
- Sentry

---

##  Native Development & Prebuilds

Because this is an Expo project with customized native layouts, follow these guidelines to keep your native layouts perfectly configured.

###  Native iOS Splash Screen Logo

On iOS, we use an automated script to dynamically scale the splash screen logo to **55% of the screen width** with a stable **1:1 aspect ratio**, matching the centered look and feel on Android.

This setup is fully automated:
1. **Running the App**: Always launch using:
   ```bash
   yarn ios
   ```
   This automatically runs our layout patch script (`node scripts/fix-ios-splash.js`) and updates the iOS storyboard before triggering the build.
2. **Performing a Clean Prebuild**: Always use:
   ```bash
   yarn prebuild --clean
   ```
   This runs the clean prebuild and then automatically triggers our `postprebuild` script to apply the storyboard patch on the fly.

> [!IMPORTANT]
> iOS aggressively caches native launch screen storyboards. If you rebuild the app and still see the old layout, **completely uninstall/delete the app** from your device or simulator, and then run `yarn ios` to compile the fresh storyboard.

###  Triggering EAS Builds

We use EAS Build to compile native binaries in the cloud. Run `eas login` first, then use the following commands:
eas init      
####  Android Builds
* **Production `.aab`** (For submitting to the Google Play Store):
  ```bash
  eas init   // 1st time   
  eas build --platform android --profile production
  ```
* **Testing `.apk`** (Signed, shareable package for testing on real devices):
  ```bash
  eas build --platform android --profile preview
  ```

####  iOS Builds
* **Production `.ipa`** (For TestFlight & App Store submission):
  ```bash
  eas build --platform ios --profile production
  ```
* **Local Simulator Build** (For testing locally on a Mac simulator):
  ```bash
  eas build --platform ios --profile development
  ```

  npx expo run:android --variant release


```
git reset --hard HEAD  
git clean -fd  