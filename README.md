# Archer-MR600-Bot
A lightweight JavaScript automation script designed to run in the browser console of the TP-Link Archer MR600 (4G+ Router).


TP-Link Archer MR600 - KPN Auto Refill Bot 🤖
A lightweight JavaScript automation script designed to run in the browser console of the TP-Link Archer MR600 (4G+ Router).


🚀 Purpose
This script automates the "Daily Bundle" refill process for KPN Unlimited (and similar providers). It monitors the router's SMS inbox for data usage warnings and automatically sends a reply to refill the data, ensuring an uninterrupted internet connection.

✨ Key Features
Automated Monitoring: Scans your inbox every 60 seconds for "80%" or "100%" usage alerts.
Smart Response: Automatically replies with the required activation code (e.g., NL2000 AAN) to 1266.
SVG Checkbox Fix: Advanced DOM-traversal to interact with the router's custom UI elements (like the tricky SVG checkboxes).

Auto-Cleanup (Wipe): To prevent the SIM/Router storage from filling up, the script triggers a "Select All + Delete" action every 10 sent messages.
State Persistence: Uses ID-tracking to ensure it only responds once per received alert.

🛠️ How to use
Log in to your Archer MR600 web interface.
Open the Browser Developer Tools (F12 or Right-click -> Inspect).
Go to the Console tab.

Paste the script and hit Enter.

Keep the browser tab open for the script to continue running.
⚠️ Disclaimer
This script is unofficial and not affiliated with TP-Link or KPN. Use at your own risk. Ensure you are on a plan where the refill SMS is free of charge to avoid unexpected costs.
