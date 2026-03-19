# IPRN Access Analyzer (Android)

Personal-use Android app for daily supplier number testing, modeled after your screenshots.

## Included screens

- Home
- Test numbers (filter/search/select all/deselect all)
- Tests (running + archived cards)
- Settings (caller ID, calling prefix, timing values)
- Navigation drawer with quick action: **Sync test numbers**

## Supplier use case

The app starts with Saudi sample suppliers:

- STC
- Mobily
- Zain

You can sync daily lists from the drawer by pasting CSV rows in this format:

`supplier,operator,number,country`

Example:

`STC,STC,966512345678,Saudi Arabia`

## Build APK in Android Studio

1. Open `iprn-access-analyzer-android/` in Android Studio (Koala or newer).
2. Let Gradle sync.
3. Build APK:
   - **Build > Build Bundle(s) / APK(s) > Build APK(s)**
4. Output path:
   - `app/build/outputs/apk/debug/app-debug.apk`

## Optional CLI build

If Android SDK and Gradle are configured on your machine:

`./gradlew assembleDebug`
