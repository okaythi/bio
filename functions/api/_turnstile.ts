export async function verifyTurnstile(token: string | undefined | null, secret: string, ip: string): Promise<boolean> {
  if (!token) return false;
  try {
    const formData = new URLSearchParams();
    formData.append('secret', secret);
    formData.append('response', token);
    formData.append('remoteip', ip);
    
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });
    if (!r.ok) return false;
    const result = await r.json() as { success?: boolean };
    return !!result.success;
  } catch (e) {
    return false;
  }
}
