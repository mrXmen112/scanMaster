# 🚀 RELEASE APK BUILD COMMANDS
# Copy-paste these commands one by one in PowerShell

# ============================================
# STEP 1: Navigate to Project Directory
# ============================================
cd D:\scanMaster_ai

# ============================================
# STEP 2: Clean Previous Builds
# ============================================
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
Remove-Item -Recurse -Force out -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force android\app\build -ErrorAction SilentlyContinue
Write-Host "✅ Clean complete!" -ForegroundColor Green

# ============================================
# STEP 3: Verify Environment Variables
# ============================================
Write-Host "`n🔍 Checking environment variables..." -ForegroundColor Yellow
Get-Content .env | Select-String "NEXT_PUBLIC_API_BASE_URL"
Get-Content .env | Select-String "OPENROUTER_API_KEY" | Select-Object -First 1

# Expected output:
# NEXT_PUBLIC_API_BASE_URL=https://scanmaster-ai.vercel.app
# OPENROUTER_API_KEY=sk-or-v1-<your-key-here>

# ============================================
# STEP 4: Build Static Export
# ============================================
Write-Host "`n🔨 Building static export for APK..." -ForegroundColor Yellow
node scripts/build-apk.js

# Wait for build to complete
# Look for these success messages:
# ✅ API Base URL: https://scanmaster-ai.vercel.app
# ✅ Static export build complete!
# ✅ API routes restored.

# ============================================
# STEP 5: Verify Build Output
# ============================================
Write-Host "`n✓ Checking build output..." -ForegroundColor Yellow
if (Test-Path "out\index.html") {
    Write-Host "✅ Build successful! out/ directory created" -ForegroundColor Green
    Write-Host "Files in out/:" -ForegroundColor Cyan
    Get-ChildItem out -Name | Select-Object -First 10
} else {
    Write-Host "❌ Build failed! out/ directory not found" -ForegroundColor Red
    exit 1
}

# ============================================
# STEP 6: Sync to Android
# ============================================
Write-Host "`n📱 Syncing to Android project..." -ForegroundColor Yellow
npx cap sync android

# Wait for sync to complete
# Look for: "✔ Copying web assets from out to android\app\src\main\assets\public"

# ============================================
# STEP 7: Open Android Studio
# ============================================
Write-Host "`n🎯 Opening Android Studio..." -ForegroundColor Yellow
npx cap open android

Write-Host "`n" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "🎉 BUILD PREPARATION COMPLETE!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "`nNext steps in Android Studio:" -ForegroundColor Yellow
Write-Host "1. Wait for Gradle sync to finish" -ForegroundColor White
Write-Host "2. Build → Generate Signed Bundle / APK" -ForegroundColor White
Write-Host "3. Select: APK" -ForegroundColor White
Write-Host "4. Choose your keystore (or create new)" -ForegroundColor White
Write-Host "5. Select: release" -ForegroundColor White
Write-Host "6. Finish" -ForegroundColor White
Write-Host "`nAPK location:" -ForegroundColor Yellow
Write-Host "android\app\build\outputs\apk\release\app-release.apk" -ForegroundColor Cyan
Write-Host "`n✨ All AI tools will work perfectly!" -ForegroundColor Green
