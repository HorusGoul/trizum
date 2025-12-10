#!/bin/bash

set -e

./copy-client.sh

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

cd $SCRIPT_DIR;

SOURCE_ICON_SVG="$SCRIPT_DIR/dist/maskable.svg"
SOURCE_SPLASH_SVG="$SCRIPT_DIR/dist/splash.svg"
TMP_DIR="$SCRIPT_DIR/node_modules/.cache/icons-tmp"
ASSETS_DIR="$SCRIPT_DIR/assets"

mkdir -p $TMP_DIR

# We need to generate the icons for the app
# in assets/ folder.
# icon-only.png
# icon-foreground.png
# icon-background.png
# splash.png
# splash-dark.png

if [ -d "$ASSETS_DIR" ]; then
  echo "Cleaning up $ASSETS_DIR directory"
  rm -rf $ASSETS_DIR
fi

mkdir -p $ASSETS_DIR

echo "Generating icons..."

TEMP_ICON_ONLY_SVG="$TMP_DIR/icon-only.svg"
TEMP_ICON_FOREGROUND_SVG="$TMP_DIR/icon-foreground.svg"
TEMP_ICON_BACKGROUND_SVG="$TMP_DIR/icon-background.svg"
TEMP_SPLASH_SVG="$TMP_DIR/splash.svg"
TEMP_SPLASH_DARK_SVG="$TMP_DIR/splash-dark.svg"

cp $SOURCE_ICON_SVG $TEMP_ICON_ONLY_SVG
cp $SOURCE_ICON_SVG $TEMP_ICON_FOREGROUND_SVG
cp $SOURCE_ICON_SVG $TEMP_ICON_BACKGROUND_SVG
cp $SOURCE_SPLASH_SVG $TEMP_SPLASH_SVG
cp $SOURCE_SPLASH_SVG $TEMP_SPLASH_DARK_SVG

echo "Exporting icon-only.png"
svgexport $TEMP_ICON_ONLY_SVG $ASSETS_DIR/icon-only.png 1024:1024

echo "Exporting icon-foreground.png"
# Remove black background from temporary icon foreground SVG
sed -i 's/fill="black"/fill="transparent"/g' $TEMP_ICON_FOREGROUND_SVG
svgexport $TEMP_ICON_FOREGROUND_SVG $ASSETS_DIR/icon-foreground.png 1024:1024

echo "Exporting icon-background.png"
# Remove white foreground from temporary icon background SVG
sed -i 's/stroke="white"/stroke="transparent"/g' $TEMP_ICON_BACKGROUND_SVG
svgexport $TEMP_ICON_BACKGROUND_SVG $ASSETS_DIR/icon-background.png 1024:1024

echo "Exporting splash.png"
svgexport $TEMP_SPLASH_SVG $ASSETS_DIR/splash.png 2732:2732

echo "Exporting splash-dark.png"
svgexport $TEMP_SPLASH_DARK_SVG $ASSETS_DIR/splash-dark.png 2732:2732

echo "Done generating base icons!"

capacitor-assets generate --ios --android

# Generate Play Store icon (512x512) for fastlane metadata
echo "Exporting Play Store icon..."
ANDROID_METADATA_DIR="$SCRIPT_DIR/android/fastlane/metadata/android"
mkdir -p "$ANDROID_METADATA_DIR/en-US/images"
svgexport $TEMP_ICON_ONLY_SVG "$ANDROID_METADATA_DIR/en-US/images/icon.png" 512:512

echo "Done!"