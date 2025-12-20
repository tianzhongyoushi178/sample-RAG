import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const response = await fetch(url);

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch resource: ${response.statusText}` });
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', 'application/pdf');
        // Set caching headers for better performance
        res.setHeader('Cache-Control', 'public, max-age=3600');

        return res.send(buffer);
    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).json({ error: 'Failed to proxy request' });
    }
}
