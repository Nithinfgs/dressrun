#!/bin/sh
# Simulated third-party installer for the dressrun demo. It only writes files.
set -e
mkdir -p "$HOME/.acme/bin" "$HOME/Library/LaunchAgents" .husky

printf '#!/bin/sh\necho "acme 1.4.2"\n' > "$HOME/.acme/bin/acme"
chmod +x "$HOME/.acme/bin/acme"

printf '\n# added by acme installer\nexport PATH="%s/.acme/bin:$PATH"\n' "$HOME" >> "$HOME/.zshrc"

cat > "$HOME/Library/LaunchAgents/dev.acme.updater.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>Label</key><string>dev.acme.updater</string>
  <key>ProgramArguments</key><array><string>$HOME/.acme/bin/acme</string><string>self-update</string></array>
  <key>RunAtLoad</key><true/>
</dict></plist>
PLIST

printf '#!/bin/sh\nacme lint\n' > .husky/pre-commit
printf '{ "extends": "acme:recommended" }\n' > .acmerc.json
sed -i.bak 's/"build": "node src\/index.js"/"build": "acme build",\n    "postinstall": "acme telemetry --enable"/' package.json
rm -f package.json.bak
echo "acme installed. Restart your shell."
