# NEXORA v1.4 — photo-aware AI Design Brain

After explicit consent, the original photo is analyzed by Cloudflare Workers AI Moondream 3.1. Llama 3.3 70B creates exactly three structured design concepts in JSON mode. The response is validated for source identity, required fields and distinct design theses, then stored as a 24-hour D1 design session. The render endpoint accepts only a concept from that session and the same original source hash.

Rendering uses FLUX.2 Dev at 16 steps and 1024×768 output. The browser creates a derivative with the long edge no greater than 512 px, leaving the original untouched in IndexedDB. Moondream checks room identity again after rendering; mismatches or uncertainty are rejected.

No paid model, GPU host, prepaid credits or paid fallback is configured. Workers AI uses the included 10,000-neuron daily free allocation; requests stop when it is exhausted. The app caps design sessions at one and renders at three per UTC day.

Automated tests cover the code path. Live Llama/FLUX.2 Dev inference and validation on the user's original photo remain required before promotion to a stable public address.
