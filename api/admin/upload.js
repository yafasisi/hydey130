const { put } = require('@vercel/blob');
const { verifyAdmin } = require('../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    try {
        const isAuthed = await verifyAdmin(req);
        if (!isAuthed) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const filename = req.query.filename || 'photo.jpg';

        const blob = await put(filename, req.body, {
            access: 'public',
            addRandomSuffix: true,
        });

        return res.status(200).json({ success: true, url: blob.url });
    } catch (error) {
        console.error('Upload error:', error.message);
        return res.status(500).json({ success: false, error: 'Upload failed: ' + error.message });
    }
};

// Disable body parsing — we need raw stream
module.exports.config = {
    api: { bodyParser: false }
};
