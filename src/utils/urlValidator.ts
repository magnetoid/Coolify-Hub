export function isValidUrl(urlString: string): boolean {
  try {
    // Add http:// if no protocol is specified
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      urlString = 'http://' + urlString;
    }

    const url = new URL(urlString);

    // Must have a hostname with at least one dot, be localhost, or be an IP address
    const hostname = url.hostname;
    const isValidHostname =
      hostname === 'localhost' ||
      /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || // IP address
      hostname.includes('.'); // Domain with at least one dot

    return isValidHostname;
  } catch {
    return false;
  }
}

export function normalizeUrl(urlString: string): string {
  // Add http:// if no protocol is specified
  if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
    urlString = 'http://' + urlString;
  }

  // Remove trailing slash
  return urlString.replace(/\/$/, '');
}
