# Use HTTPS Tunnel First and Keep mkcert as Fallback

AI-DJ will use an HTTPS tunnel as the primary Demo Access Path for real phone camera and microphone access, because it is the fastest route to mobile testing in a 2-day hackathon. Local trusted certificates with `mkcert` remain a fallback or extension if internet access is unreliable or local-network-only operation becomes necessary.
