Nexus Plan 🚀

Interactive Program Roadmap & Dependency Manager

Nexus Plan is a modern, React-based tool designed for Program Managers to visualize complex timelines, manage cross-component dependencies, and track milestones effectively. Unlike static spreadsheets, Nexus Plan offers a dynamic "Tetris-like" scheduling engine that automatically adjusts for overlap and highlights schedule risks.

✨ Key Features

📅 Dynamic Timeline: Switch seamlessly between Week and Quarter views to manage both micro-details and macro-strategy.

🔗 Smart Dependencies: Map relationships between activities.

Blockers (Red Line): Critical path dependencies.

Normal (Blue Dashed): Standard relationships.

🖱️ Drag-and-Drop: Intuitively move tasks or resize durations directly on the Gantt chart.

🧱 Auto-Stacking Layout: The layout engine automatically detects overlapping tasks within a component and stacks them vertically ("Tetris logic").

🚩 Milestone Tracking: Dedicated lane for Go-Live dates, Status Reports, and key decision points.

⚠️ Risk Detection: Automatic detection of schedule overruns based on the defined program view window.

🛠️ Tech Stack

Frontend: React (v18+)

Build Tool: Vite

Styling: Tailwind CSS (v3)

Icons: Lucide React

Date Logic: date-fns

🚀 Getting Started

Prerequisites

Node.js (v18 or higher)

npm (v9 or higher)

Local Installation

Clone the repository:

git clone [https://github.com/ayushjain82/NexusPlan.git](https://github.com/ayushjain82/NexusPlan.git)
cd NexusPlan


Install dependencies:

npm install


Run the development server:

npm run dev


Open http://localhost:5173 in your browser.

☁️ Running in GitHub Codespaces

You can develop this project entirely in the cloud without installing anything locally.

Click the green <> Code button on the GitHub repo page.

Select the Codespaces tab.

Click Create codespace on main.

Once the editor loads, the environment will auto-configure. Just run:

npm run dev


📦 Deployment

This project is configured for GitHub Pages.

To deploy a new version:

Ensure your vite.config.js has the correct base path:

base: '/NexusPlan/',


Run the deploy script:

npm run deploy


This script builds the app and pushes the dist folder to the gh-pages branch.

🤝 Contributing

Fork the Project

Create your Feature Branch (git checkout -b feature/AmazingFeature)

Commit your Changes (git commit -m 'Add some AmazingFeature')

Push to the Branch (git push origin feature/AmazingFeature)

Open a Pull Request

📄 License

Distributed under the MIT License. See LICENSE for more information.

Built with "Vibe Coding" methodology.
