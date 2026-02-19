.
🤖 TP-Link Archer MR600 - KPN Auto Refill Bot (Chrome Extension)
This Chrome Extension automates the "Unlimited Data" refill process for Simcard users and similar providers on the TP-Link Archer MR600 4G+ Router.

🌟 Features
Zero-Config Hover Menu: An integrated settings panel directly on the router's web interface (no more pinning extensions).

Automated Monitoring: Scans incoming SMS for "80%" or "100%" data usage warnings.

Instant Response: Automatically replies with NL2000 AAN (or your custom command) to 1266.

Full Storage Wipe: Automatically clears both Inbox and Outbox after 10 refills to prevent SIM storage from clogging.

Persistent Settings: Saves your custom targets and messages in the browser's local storage.

🛠️ Installation
Download/Clone this repository to your computer.
Open Google Chrome and go to chrome://extensions/.
Enable "Developer mode" in the top right corner.
Click "Load unpacked" and select the folder containing the extension files.
Navigate to your router (usually http://tplinkmodem.net or 192.168.1.1). >  http://tplinkmodem.net will work best and is the tested and most supported page.
The MR600 Bot menu will appear automatically on the right side of the screen.

📦 Files in this repo
manifest.json: Extension configuration.
content.js: The "brain" of the bot and the injected UI.
popup.html/js: (Optional) Quick settings access.

🤝 Credits
This project was developed in collaboration with a Google AI Assistant. The goal was to overcome the specific DOM-rendering challenges of the TP-Link web interface and provide a user-friendly automation tool for KPN customers.

⚠️ Disclaimer
This script is an unofficial community project and is not affiliated with TP-Link or KPN. Use at your own risk. Always ensure that refill SMS messages are free of charge on your specific plan.

for bugs ore questions contact at discord: dutch_bastard_65756


