/**
 * Convert an image record to a proxy URL.
 * Private Vercel Blob URLs need to go through our API proxy.
 * Local /uploads/ paths also go through the proxy.
 */
export function getImageProxyUrl(imageId: number): string {
  return `/api/images/${imageId}`;
}
