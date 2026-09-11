import { ExternalLink } from "lucide-react";

const APP_CATEGORIES = [
  {
    category: "Microsoft Office",
    apps: [
      { name: "Word", description: "Word processing & documents", url: "https://www.office.com/launch/word", color: "#185ABD", icon: "https://upload.wikimedia.org/wikipedia/commons/f/fd/Microsoft_Office_Word_%282019%E2%80%93present%29.svg" },
      { name: "Excel", description: "Spreadsheets & data", url: "https://www.office.com/launch/excel", color: "#107C41", icon: "https://upload.wikimedia.org/wikipedia/commons/3/34/Microsoft_Office_Excel_%282019%E2%80%93present%29.svg" },
      { name: "PowerPoint", description: "Presentations", url: "https://www.office.com/launch/powerpoint", color: "#C43E1C", icon: "https://upload.wikimedia.org/wikipedia/commons/0/0d/Microsoft_Office_PowerPoint_%282019%E2%80%93present%29.svg" },
      { name: "Outlook", description: "Email & calendar", url: "https://outlook.live.com", color: "#0078D4", icon: "https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg" },
      { name: "Teams", description: "Chat & meetings", url: "https://teams.microsoft.com", color: "#6264A7", icon: "https://upload.wikimedia.org/wikipedia/commons/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg" },
      { name: "OneDrive", description: "Cloud storage", url: "https://onedrive.live.com", color: "#0078D4", icon: "https://upload.wikimedia.org/wikipedia/commons/3/3c/Microsoft_Office_OneDrive_%282019%E2%80%93present%29.svg" },
    ],
  },
  {
    category: "Google Workspace",
    apps: [
      { name: "Google Docs", description: "Collaborative documents", url: "https://docs.google.com", color: "#4285F4", icon: "https://upload.wikimedia.org/wikipedia/commons/0/01/Google_Docs_logo_%282014-2020%29.svg" },
      { name: "Google Sheets", description: "Spreadsheets", url: "https://sheets.google.com", color: "#0F9D58", icon: "https://upload.wikimedia.org/wikipedia/commons/a/ae/Google_Sheets_2020_Logo.svg" },
      { name: "Google Slides", description: "Presentations", url: "https://slides.google.com", color: "#F4B400", icon: "https://upload.wikimedia.org/wikipedia/commons/1/1e/Google_Slides_logo_%282014-2020%29.svg" },
      { name: "Google Drive", description: "File storage", url: "https://drive.google.com", color: "#4285F4", icon: "https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" },
      { name: "Gmail", description: "Email", url: "https://mail.google.com", color: "#EA4335", icon: "https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg" },
      { name: "Google Meet", description: "Video conferencing", url: "https://meet.google.com", color: "#00897B", icon: "https://upload.wikimedia.org/wikipedia/commons/9/9b/Google_Meet_icon_%282020%29.svg" },
    ],
  },
  {
    category: "CRM & Project Management",
    apps: [
      { name: "HubSpot", description: "CRM & marketing", url: "https://app.hubspot.com", color: "#FF7A59", icon: null, initials: "HS" },
      { name: "Salesforce", description: "Enterprise CRM", url: "https://login.salesforce.com", color: "#00A1E0", icon: null, initials: "SF" },
      { name: "Notion", description: "Docs, wikis & tasks", url: "https://notion.so", color: "#000000", icon: null, initials: "No" },
      { name: "Trello", description: "Kanban boards", url: "https://trello.com", color: "#0052CC", icon: null, initials: "Tr" },
      { name: "Asana", description: "Project management", url: "https://app.asana.com", color: "#F06A6A", icon: null, initials: "As" },
      { name: "Slack", description: "Team messaging", url: "https://slack.com", color: "#4A154B", icon: null, initials: "Sl" },
      { name: "Zoom", description: "Video conferencing", url: "https://zoom.us", color: "#2D8CFF", icon: null, initials: "Zo" },
      { name: "QuickBooks", description: "Accounting", url: "https://quickbooks.intuit.com", color: "#2CA01C", icon: null, initials: "QB" },
    ],
  },
];

export default function Apps() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Apps &amp; Tools</h1>
        <p className="text-sm text-muted-foreground">Quick access to your favourite office and CRM applications</p>
      </div>

      <div className="space-y-8">
        {APP_CATEGORIES.map(cat => (
          <div key={cat.category}>
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">{cat.category}</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
              {cat.apps.map(app => (
                <a
                  key={app.name}
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-3 hover:shadow-md hover:border-primary/30 transition-all text-center"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden"
                    style={{ background: app.icon ? "transparent" : app.color + "15" }}
                  >
                    {app.icon ? (
                      <img src={app.icon} alt={app.name} className="w-10 h-10 object-contain" onError={e => { e.target.style.display = "none"; }} />
                    ) : (
                      <span className="text-lg font-black" style={{ color: app.color }}>{app.initials}</span>
                    )}
                  </div>
                  <div className="min-w-0 w-full">
                    <p className="text-sm font-semibold text-foreground truncate">{app.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{app.description}</p>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}