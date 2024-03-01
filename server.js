const express = require('express');
const dot = require('dotenv');
const cors = require('cors');
const connectDatabase = require('./config/database');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Initialize express app
const app = express();

// Load environment variables
dot.config({ path: 'backend/config/config.env' });

// Connecting to database
connectDatabase();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer for file upload
const storage = multer.diskStorage({});
const upload = multer({ storage });

// Allow CORS for all routes
app.use(cors());

// Route to upload video
app.post('/upload', upload.single('video'), async (req, res) => {
    try {
        // Check if file is uploaded
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Get file path
        const filePath = req.file.path;

        // Check if file exists and is not empty
        const stats = fs.statSync(filePath);
        if (!stats.isFile() || stats.size === 0) {
            return res.status(400).json({ message: 'Empty file' });
        }

        // Initialize progress to 0
        let progress = 0;

        // Upload file to Cloudinary
        const options = {
            resource_type: 'video',
            onUploadProgress: (data) => {
                // Calculate percentage progress dynamically
                const percentCompleted = Math.round((data.loaded * 100) / data.total);
                // If the progress has increased, send the updated progress to the client using SSE
                if (percentCompleted > progress) {
                    progress = percentCompleted;
                    res.write(`data: ${progress}\n\n`);
                }
            }
        };

        // Upload the file to Cloudinary
        const result = await cloudinary.uploader.upload_large(filePath, options);

        // Delete the temporary file
        fs.unlinkSync(filePath);

        // Send back the URL of the uploaded video
        res.json({ url: result.secure_url });
    } catch (error) {
        console.error('Error uploading video:', error);
        res.status(500).json({ message: 'Upload failed', error: error.message });
    }
});

// Route to handle SSE for progress updates
app.get('/progress', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Listen for progress updates from Cloudinary (not used in this version)
    // This route will be updated to send real-time progress updates from the upload route

    // Handle client disconnect
    req.on('close', () => {
        res.end();
    });
});

// Start the server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
