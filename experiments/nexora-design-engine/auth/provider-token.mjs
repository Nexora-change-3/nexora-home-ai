export function resolveProviderToken(request, env = {}) {
  const supplied = request?.headers?.get("x-hf-token")?.trim() || "";
  const configured = typeof env.HF_TOKEN === "string" ? env.HF_TOKEN.trim() : "";
  const token = supplied || configured;
  if (!token) return null;
  if (token.length > 256 || !/^hf_[A-Za-z0-9]{20,}$/.test(token)) {
    const error = new Error("Hugging Face token format is invalid.");
    error.code = "INVALID_HF_TOKEN";
    error.status = 400;
    throw error;
  }
  return token;
}
