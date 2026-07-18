# Use ASP.NET Core and SignalR for the Local Server

AI-DJ will use an ASP.NET Core server with SignalR for realtime participant and output-tab communication, while keeping browser-side capture and synthesis in TypeScript. This is a deliberate trade-off against the simpler all-TypeScript Node/`ws` stack: SignalR adds framework structure and reconnect semantics, and the team prefers committing to .NET for the server while avoiding server-side audio synthesis.
