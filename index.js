require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');
const stream = require('stream');
const FileType = require('file-type');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Serve HTML file
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// API Endpoint 1: Upload image with proper content type detection
app.post('/api/upload', express.raw({ 
  type: (req) => true, // Accept all content types
  limit: '10mb'
}), async (req, res) => {
  try {
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Detect file type
    const fileType = await FileType.fromBuffer(req.body);
    if (!fileType) {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    // Supported image types
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!supportedTypes.includes(fileType.mime)) {
      return res.status(400).json({ error: 'Only JPEG, PNG, GIF, and WebP are supported' });
    }

    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.body);

    const formData = new FormData();
    formData.append('file', bufferStream, {
      filename: `upload-${Date.now()}.${fileType.ext}`,
      contentType: fileType.mime
    });

    const uploadResponse = await axios.post(
      'https://temp.fenghuochatbot.site/api/upload', 
      formData, 
      {
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    res.json({
      success: true,
      message: 'Image successfully uploaded',
      imageUrl: uploadResponse.data.fullUrl,
      fileName: uploadResponse.data.fileName,
      fileType: fileType.mime
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload image',
      details: error.message 
    });
  }
});

// API Endpoint 2: Convert to Ghibli style with proper content type handling

app.post('/api/convert-to-ghibli', async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    // 1. Call Exonity API
    const exonityUrl = `https://exonity.tech/api/ghibli-converter?image_url=${encodeURIComponent(imageUrl)}&prompt=Ghibli%20Studio%20style%2C%20Charming%20hand-drawn%20anime-style%20illustration&seed=42&style=Ghibli&enable_hr=false&hr_scale=1`;
    
    const response = await axios.get(exonityUrl, { timeout: 30000 });
    
    if (!response.data.status || !response.data.result) {
      throw new Error('Invalid response from Exonity API');
    }

    const convertedUrl = response.data.result;

    // 2. Download the converted image
    const imageResponse = await axios.get(convertedUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    // 3. Detect file type
    const fileType = await FileType.fromBuffer(imageResponse.data);
    if (!fileType || !fileType.mime.startsWith('image/')) {
      throw new Error('Invalid image data from converter');
    }

    // 4. Upload to Feng's storage
    const formData = new FormData();
    formData.append('file', imageResponse.data, {
      filename: `ghibli-${Date.now()}.${fileType.ext}`,
      contentType: fileType.mime
    });

    const uploadResponse = await axios.post(
      'https://temp.fenghuochatbot.site/api/upload',
      formData,
      {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity
      }
    );

    // 5. Return Feng's URL
    res.json({
      success: true,
      message: 'Conversion successful',
      imageUrl: uploadResponse.data.fullUrl
    });

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({
      error: 'Failed to convert image',
      details: error.message,
      step: error.step || 'unknown' 
    });
  }
});
// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
