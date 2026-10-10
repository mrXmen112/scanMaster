# Capacitor WebView - keep all JS bridge methods
-keepclassmembers class com.getcapacitor.* {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.getcapacitor.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.getcapacitor.**
-dontwarn com.google.android.gms.**

# Keep plugin classes
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.CapacitorPlugin <methods>;
    <methods>;
}

# Keep AdMob classes
-keep class com.google.ads.** { *; }
-dontwarn com.google.ads.**

# Keep all native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep JavascriptInterface annotations
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebView JavaScript bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface public *;
}
