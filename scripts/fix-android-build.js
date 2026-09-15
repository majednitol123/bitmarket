const fs = require('fs');
const path = require('path');

function patchAndroidBuild() {
  const buildGradlePath = path.join(__dirname, '../android/app/build.gradle');
  
  if (!fs.existsSync(buildGradlePath)) {
    console.error('[-] android/app/build.gradle not found. Skipping Android architecture split patching.');
    return;
  }

  let content = fs.readFileSync(buildGradlePath, 'utf8');

  // Check if splits configuration is already injected
  if (content.includes('splits {') && content.includes('abi {')) {
    console.log('[+] android/app/build.gradle already patched with architecture splits.');
    return;
  }

  // Define the splits configuration block to insert
  const splitsBlock = `    splits {
        abi {
            enable true
            reset()
            include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
            universalApk false
        }
    }

    defaultConfig {`;

  // Insert splits block right before defaultConfig
  if (content.includes('defaultConfig {')) {
    content = content.replace('defaultConfig {', splitsBlock);
    fs.writeFileSync(buildGradlePath, content, 'utf8');
    console.log('[+] Successfully injected CPU architecture splits into android/app/build.gradle!');
  } else {
    console.error('[-] Could not locate "defaultConfig {" in build.gradle to inject splits.');
  }
}

function patchGradleProperties() {
  const gradlePropsPath = path.join(__dirname, '../android/gradle.properties');
  if (!fs.existsSync(gradlePropsPath)) return;

  let props = fs.readFileSync(gradlePropsPath, 'utf8');
  if (props.includes('org.gradle.jvmargs=')) {
    props = props.replace(/org\.gradle\.jvmargs=.*/, 'org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError');
    fs.writeFileSync(gradlePropsPath, props, 'utf8');
    console.log('[+] Configured Gradle JVM args with 4GB heap and 1024MB Metaspace.');
  }
}

patchAndroidBuild();
patchGradleProperties();
