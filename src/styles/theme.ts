export type ThemeType = {
  colors: {
    primary: string;
    primaryLight: string;
    dark: string;
    darker: string;
    lightDark: string;
    cardBackground: string;
    accent: string;
    background: string;
    highlight: string;
    white: string;
    offWhite: string;
    lightGrey: string;
    grey: string;
    muted: string;
    error: string;
    success: string;
    ethereum: string;
    solana: string;
    border: string;
    borderLight: string;
    primaryLinearGradient: readonly [string, string, ...string[]];
    secondaryLinearGradient: readonly [string, string, ...string[]];
    cardGradient: readonly [string, string, ...string[]];
    headerGradient: readonly [string, string, ...string[]];
    buttonGradient: readonly [string, string, ...string[]];
    gold: string;
    blue: string;
    darkText: string;
    realWhite: string;
    black: string;
  };
  fonts: {
    families: {
      openRegular: string;
      openBold: string;
      robotoRegular: string;
      robotoBold: string;
    };
    sizes: {
      tiny: string;
      small: string;
      normal: string;
      large: string;
      header: string;
      title: string;
      huge: string;
      uberHuge: string;
    };
    weights: {
      normal: string;
      bold: string;
    };
    colors: {
      primary: string;
      dark: string;
      accent: string;
      background: string;
      highlight: string;
    };
  };
  spacing: {
    tiny: string;
    small: string;
    medium: string;
    large: string;
    huge: string;
  };
  borderRadius: {
    small: string;
    default: string;
    medium: string;
    large: string;
    extraLarge: string;
    pill: string;
  };
};

export const DarkTheme: ThemeType = {
  colors: {
    // Premium dark crypto palette (Vibrant Purple & Sleek Dark Slate)
    primary: "#8B5CF6",          // Vibrant purple - primary accent
    primaryLight: "#A78BFA",     // Soft purple
    gold: "#8B5CF6",
    blue: "#8B5CF6",             // Purple accent
    dark: "#0B0E17",             // Deep sleek dark slate background (matches screenshot 2)
    darker: "#070910",           // Even darker slate
    lightDark: "#111522",        // Card/surface background
    cardBackground: "#131827",   // Sleek dark card bg (matches screenshot 2)
    accent: "#A855F7",           // Radiant purple accent
    background: "#0B0E17",
    highlight: "#A855F7",
    white: "#FFFFFF",
    offWhite: "#F5F5F5",
    lightGrey: "#94A3B8",        // Secondary text (slate-400)
    grey: "#64748B",             // Muted elements (slate-500)
    muted: "#1E293B",            // Borders, dividers
    error: "#EF4444",
    success: "#10B981",
    ethereum: "#627EEA",
    solana: "#00DCFA",
    border: "#1F2639",           // Subtle sleek border (matches screenshot 2)
    borderLight: "#2A334D",
    // Gradients
    primaryLinearGradient: ["#0B0E17", "#0D111E", "#0B0E17"] as const,
    secondaryLinearGradient: ["#131827", "#0B0E17"] as const,
    cardGradient: ["#131827", "#101422"] as const,
    headerGradient: ["rgba(11, 14, 23, 0.95)", "rgba(11, 14, 23, 0)"] as const,
    buttonGradient: ["#7C3AED", "#A855F7"] as const,
    darkText: "#FFFFFF",
    realWhite: "#FFFFFF",
    black: "#000000",
  },
  fonts: {
    families: {
      openRegular: "OpenSans_400Regular",
      openBold: "OpenSans_700Bold",
      robotoRegular: "Roboto_400Regular",
      robotoBold: "Roboto_700Bold",
    },
    sizes: {
      tiny: "10px",
      small: "12px",
      normal: "14px",
      large: "16px",
      header: "18px",
      title: "24px",
      huge: "32px",
      uberHuge: "48px",
    },
    weights: {
      normal: "400",
      bold: "700",
    },
    colors: {
      primary: "#FFFFFF",
      dark: "#0B0E1A",
      accent: "#8B5CF6",
      background: "#0B0E1A",
      highlight: "#A855F7",
    },
  },
  spacing: {
    tiny: "4px",
    small: "8px",
    medium: "16px",
    large: "24px",
    huge: "32px",
  },
  borderRadius: {
    small: "4px",
    default: "8px",
    medium: "12px",
    large: "16px",
    extraLarge: "24px",
    pill: "999px",
  },
};

export const LightTheme: ThemeType = {
  colors: {
    // Premium light crypto palette (Royal Purple & Violet)
    primary: "#7C3AED",          // Rich royal purple
    primaryLight: "#8B5CF6",
    gold: "#7C3AED",
    blue: "#7C3AED",
    dark: "#F4F6FA",             // Light cool-grey app background
    darker: "#E8ECF4",           // Subtle background overlay
    lightDark: "#FFFFFF",        // Opaque white container background
    cardBackground: "#FFFFFF",   // Solid opaque white card bg
    accent: "#8B5CF6",
    background: "#F4F6FA",
    highlight: "#8B5CF6",
    white: "#0B0E1A",            // Map white to dark slate for automatic typography inversion
    offWhite: "#1E293B",         // Slate-800
    lightGrey: "#64748B",        // Slate-500 (high contrast secondary text)
    grey: "#94A3B8",             // Slate-400 (muted details)
    muted: "#CBD5E1",            // Slate-300 (borders and dividers)
    error: "#FF4D4F",
    success: "#00B074",          // Darker green for accessibility on light background
    ethereum: "#627EEA",         // Darker violet for readability
    solana: "#008A9E",           // Darker teal for readability
    border: "#E2E8F0",           // Light grey borders
    borderLight: "#EDF2F7",
    // Gradients
    primaryLinearGradient: ["#F4F6FA", "#E2E8F0"] as const,
    secondaryLinearGradient: ["#FFFFFF", "#F4F6FA"] as const,
    cardGradient: ["#FFFFFF", "#F8FAFC"] as const,
    headerGradient: ["rgba(244, 246, 250, 0.95)", "rgba(244, 246, 250, 0)"] as const,
    buttonGradient: ["#7C3AED", "#A855F7"] as const,
    darkText: "#FFFFFF",
    realWhite: "#FFFFFF",
    black: "#000000",
  },
  fonts: {
    families: {
      openRegular: "OpenSans_400Regular",
      openBold: "OpenSans_700Bold",
      robotoRegular: "Roboto_400Regular",
      robotoBold: "Roboto_700Bold",
    },
    sizes: {
      tiny: "10px",
      small: "12px",
      normal: "14px",
      large: "16px",
      header: "18px",
      title: "24px",
      huge: "32px",
      uberHuge: "48px",
    },
    weights: {
      normal: "400",
      bold: "700",
    },
    colors: {
      primary: "#0B0E1A",        // Text in buttons defaults to dark slate
      dark: "#0B0E1A",
      accent: "#7C3AED",
      background: "#F4F6FA",
      highlight: "#8B5CF6",
    },
  },
  spacing: {
    tiny: "4px",
    small: "8px",
    medium: "16px",
    large: "24px",
    huge: "32px",
  },
  borderRadius: {
    small: "4px",
    default: "8px",
    medium: "12px",
    large: "16px",
    extraLarge: "24px",
    pill: "999px",
  },
};
