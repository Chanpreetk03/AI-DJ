# Server Owns Room State and Music Parameters

AI-DJ will make the ASP.NET Core server authoritative for both Room State and Music Parameters. The output browser tab only renders audio from received parameters, which keeps tests, dashboards, synthetic fallback, and live audio aligned to one canonical interpretation of the room.
