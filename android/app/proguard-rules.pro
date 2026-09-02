# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# JNA & Java AWT (Suppresses missing class warnings during R8 minification)
-dontwarn java.awt.**
-dontwarn com.sun.jna.**
-dontwarn javax.annotation.**
-dontwarn org.bouncycastle.**
-dontwarn org.bitcoinj.**
-keep class com.sun.jna.** { *; }
-keepclassmembers class * extends com.sun.jna.** { *; }

# Web3 / Crypto dependencies
-dontwarn org.slf4j.**
-dontwarn com.fasterxml.jackson.**
-dontwarn okhttp3.**
-dontwarn okio.**
