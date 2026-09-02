const fs = require("fs");
const path = require("path");

function findStoryboard() {
  const iosDir = path.join(__dirname, "../ios");
  if (!fs.existsSync(iosDir)) {
    console.error("[-] iOS directory does not exist. Run expo prebuild first.");
    return null;
  }

  // Find SplashScreen.storyboard in ios directory
  const files = fs.readdirSync(iosDir);
  for (const file of files) {
    const fullPath = path.join(iosDir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      const storyboardPath = path.join(fullPath, "SplashScreen.storyboard");
      if (fs.existsSync(storyboardPath)) {
        return storyboardPath;
      }
    }
  }
  return null;
}

function fixSplash() {
  const storyboardPath = findStoryboard();
  if (!storyboardPath) {
    console.error("[-] SplashScreen.storyboard not found in ios subfolders.");
    return;
  }

  console.log(`[+] Found Storyboard at: ${storyboardPath}`);
  let content = fs.readFileSync(storyboardPath, "utf8");

  // Regex to match ANY constraints block inside the ContainerView (under EXPO-SplashScreen)
  // or specifically the full screen constraints if they are still there.
  const constraintsRegex = /<constraints>\s*<constraint firstItem="EXPO-SplashScreen" firstAttribute="(top|centerX)"[^>]*?\/>\s*<constraint firstItem="EXPO-SplashScreen" firstAttribute="(leading|centerY)"[^>]*?\/>\s*(?:<constraint firstItem="EXPO-SplashScreen" firstAttribute="trailing"[^>]*?\/>\s*<constraint firstItem="EXPO-SplashScreen" firstAttribute="bottom"[^>]*?\/>\s*)?<\/constraints>/;

  const centerConstraints = `<constraints>
                            <constraint firstItem="EXPO-SplashScreen" firstAttribute="centerX" secondItem="EXPO-ContainerView" secondAttribute="centerX" id="expo-splash-center-x"/>
                            <constraint firstItem="EXPO-SplashScreen" firstAttribute="centerY" secondItem="EXPO-ContainerView" secondAttribute="centerY" id="expo-splash-center-y"/>
                            <constraint firstItem="EXPO-SplashScreen" firstAttribute="width" secondItem="EXPO-ContainerView" secondAttribute="width" multiplier="0.55" id="expo-splash-width-proportional"/>
                        </constraints>`;

  // Regex to match the image view element (handles both old full-frame and our previous fixed 150x150 frames)
  const imageViewRegex = /<imageView id="EXPO-SplashScreen" userLabel="SplashScreenLogo" image="SplashScreenLogo" contentMode="scaleAspectFit" clipsSubviews="true" userInteractionEnabled="false" translatesAutoresizingMaskIntoConstraints="false">[\s\S]*?<\/imageView>/;

  const newImageView = `<imageView id="EXPO-SplashScreen" userLabel="SplashScreenLogo" image="SplashScreenLogo" contentMode="scaleAspectFit" clipsSubviews="true" userInteractionEnabled="false" translatesAutoresizingMaskIntoConstraints="false">
                                <rect key="frame" x="88.5" y="318" width="216" height="216"/>
                                <constraints>
                                    <constraint firstAttribute="width" secondItem="EXPO-SplashScreen" secondAttribute="height" multiplier="1:1" id="expo-splash-aspect-ratio"/>
                                </constraints>
                            </imageView>`;

  let modified = false;

  if (constraintsRegex.test(content)) {
    content = content.replace(constraintsRegex, centerConstraints);
    console.log("[+] Successfully replaced constraints with centerX/centerY and proportional width (55%).");
    modified = true;
  } else {
    console.log("[!] Constraints regex did not match. Trying standard fallback replacement...");
    // Fallback search and replace if they got modified differently
    const backupConstraintsRegex = /<viewLayoutGuide key="safeArea" id="Rmq-lb-GrQ"\/>\s*<constraints>[\s\S]*?<\/constraints>/;
    const backupReplacement = `<viewLayoutGuide key="safeArea" id="Rmq-lb-GrQ"/>
                        <constraints>
                            <constraint firstItem="EXPO-SplashScreen" firstAttribute="centerX" secondItem="EXPO-ContainerView" secondAttribute="centerX" id="expo-splash-center-x"/>
                            <constraint firstItem="EXPO-SplashScreen" firstAttribute="centerY" secondItem="EXPO-ContainerView" secondAttribute="centerY" id="expo-splash-center-y"/>
                            <constraint firstItem="EXPO-SplashScreen" firstAttribute="width" secondItem="EXPO-ContainerView" secondAttribute="width" multiplier="0.55" id="expo-splash-width-proportional"/>
                        </constraints>`;
    if (backupConstraintsRegex.test(content)) {
      content = content.replace(backupConstraintsRegex, backupReplacement);
      console.log("[+] Successfully replaced constraints using fallback method.");
      modified = true;
    }
  }

  if (imageViewRegex.test(content)) {
    content = content.replace(imageViewRegex, newImageView);
    console.log("[+] Successfully set image view aspect-ratio 1:1 and frame bounds.");
    modified = true;
  } else {
    console.log("[!] ImageView regex did not match.");
  }

  if (modified) {
    fs.writeFileSync(storyboardPath, content, "utf8");
    console.log("[+] Storyboard file successfully updated.");
  } else {
    console.log("[!] No modifications were made to the storyboard file.");
  }
}

function fixFrameworks() {
  const frameworksScript = path.join(__dirname, "../ios/Pods/Target Support Files/Pods-BitMarket/Pods-BitMarket-frameworks.sh");
  if (!fs.existsSync(frameworksScript)) return;

  let content = fs.readFileSync(frameworksScript, "utf8");
  if (!content.includes("ExpoModulesJSI/ExpoModulesJSI.framework")) {
    const jsiLine = '  install_framework "${PODS_XCFRAMEWORKS_BUILD_DIR}/ExpoModulesJSI/ExpoModulesJSI.framework"';
    content = content.replace(
      /install_framework "\$\{PODS_XCFRAMEWORKS_BUILD_DIR\}\/ExpoModulesCore\/ExpoModulesCore\.framework"/g,
      `${jsiLine}\n  install_framework "\${PODS_XCFRAMEWORKS_BUILD_DIR}/ExpoModulesCore/ExpoModulesCore.framework"`
    );
    fs.writeFileSync(frameworksScript, content, "utf8");
    console.log("[+] Added ExpoModulesJSI to Pods-BitMarket-frameworks.sh.");
  }
}

fixSplash();
fixFrameworks();
