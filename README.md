🤖 MR600-Bot v1.0
Universal SMS Automation for TP-Link Archer MR600


MR600-Bot is a lightweight Chrome Extension specifically developed for the TP-Link Archer MR600 4G+ Router. This tool automates repetitive SMS tasks, such as responding to data-limit warnings from service providers or managing remote-triggered commands.

🌟 Key Features

⚡ Zero-Config Hover Menu: An integrated settings panel injected directly into the router's web interface. No more pinning extensions or digging through menus.

🔍 Smart Monitoring: Continuously scans incoming SMS messages for specific keywords (e.g., "80%", "100%", or custom triggers).

🚀 Instant Response: Automatically sends a predefined reply to a target number as soon as a trigger is detected.

🧹 Full Storage Wipe: Automatically clears both Inbox and Outbox after a set number of actions (default: 10). This prevents the SIM card storage from filling up and blocking new incoming messages.

💾 Local Storage: Your settings are saved securely and locally within your own browser.

🛠️ Installation
Download or Clone this repository to your computer.
Open Google Chrome and navigate to chrome://extensions/.
Enable "Developer mode" (toggle in the top right corner).
Click "Load unpacked" and select the folder containing the extension files.
Log in to your router via http://tplinkmodem.net (this is the most stable and tested entry point).
The MR600-Bot menu will automatically appear on the right side of your screen.

📦 Repository Structure
manifest.json: Extension configuration and permissions.
content.js: The core engine; handles UI injection, SMS scanning, and automation logic.
popup.html/js: Optional secondary access point for settings via the browser toolbar.

🤝 Credits & Support
This project was developed by dutch_bastard_65756 (discord) in collaboration with a Google AI Assistant. Together, we overcame the specific DOM-rendering and SVG-checkbox challenges of the TP-Link web interface to create a reliable automation tool.
Bugs or Questions? Contact via Discord: dutch_bastard_65756

⚠️ Disclaimer
This script is an unofficial community project and is not affiliated with TP-Link or any specific ISP. Use at your own risk. Always verify that automated SMS messages are included in your service plan to avoid unexpected charges.
Maintained by dutch_bastard_65756
