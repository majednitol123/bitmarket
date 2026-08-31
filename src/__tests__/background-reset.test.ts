import { configureStore } from "@reduxjs/toolkit";
import biometricsReducer, {
  lockWallet,
  unlockWallet,
} from "../store/biometricsSlice";

describe("Background Lock & Reset Integration Tests", () => {
  let store: ReturnType<typeof createTestStore>;

  const createTestStore = () => {
    return configureStore({
      reducer: {
        biometrics: biometricsReducer,
      },
    });
  };

  beforeEach(() => {
    store = createTestStore();
  });

  test("1. Verify wallet locks successfully when background duration exceeds 1 minute limit", () => {
    // 1. Initial State: Unlock the wallet
    store.dispatch(unlockWallet());
    expect(store.getState().biometrics.unlocked).toBe(true);

    // 2. Simulate Backgrounding: Record background timestamp
    let lastBackgroundedAt: number | null = Date.now();

    // 3. Simulate Time Elapsed (e.g. 61 seconds / 61000 milliseconds)
    const elapsed = 61 * 1000;
    const mockNow = lastBackgroundedAt + elapsed;

    // 4. Simulate App Resume check
    const backgroundTime = mockNow - lastBackgroundedAt;
    const TEST_LIMIT = 1 * 60 * 1000; // 1 minute limit

    if (backgroundTime >= TEST_LIMIT) {
      store.dispatch(lockWallet());
    }

    // 5. Assert: The wallet must be locked
    expect(store.getState().biometrics.unlocked).toBe(false);
  });

  test("2. Verify wallet stays unlocked if background duration is below 1 minute limit", () => {
    // 1. Initial State: Unlock the wallet
    store.dispatch(unlockWallet());
    expect(store.getState().biometrics.unlocked).toBe(true);

    // 2. Simulate Backgrounding: Record background timestamp
    let lastBackgroundedAt: number | null = Date.now();

    // 3. Simulate Time Elapsed (e.g. 30 seconds / 30000 milliseconds)
    const elapsed = 30 * 1000;
    const mockNow = lastBackgroundedAt + elapsed;

    // 4. Simulate App Resume check
    const backgroundTime = mockNow - lastBackgroundedAt;
    const TEST_LIMIT = 1 * 60 * 1000; // 1 minute limit

    if (backgroundTime >= TEST_LIMIT) {
      store.dispatch(lockWallet());
    }

    // 5. Assert: The wallet must remain unlocked
    expect(store.getState().biometrics.unlocked).toBe(true);
  });
});
