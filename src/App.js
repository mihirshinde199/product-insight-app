import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Helper function to convert base64 to ArrayBuffer (for TTS, if implemented later)
function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper function to convert PCM to WAV (for TTS, if implemented later)
function pcmToWav(pcmData, sampleRate) {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit PCM
  const byteRate = numChannels * sampleRate * bytesPerSample;
  const blockAlign = numChannels * bytesPerSample;

  const wavBuffer = new ArrayBuffer(44 + pcmData.byteLength);
  const view = new DataView(wavBuffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmData.byteLength, true);
  writeString(view, 8, 'WAVE');

  // FMT sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true); // BitsPerSample

  // Data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, pcmData.byteLength, true);

  // Write PCM data
  new Uint8Array(wavBuffer, 44).set(new Uint8Array(pcmData.buffer));

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Fixed exchange rates for demonstration purposes
const EXCHANGE_RATES = {
  'USD': 1,
  'INR': 83.00, // Example rate: 1 USD = 83 INR
  'EUR': 0.92,  // Example rate: 1 USD = 0.92 EUR
};

// Main App Component
const App = () => {
  const [productName, setProductName] = useState('');
  const [productDetails, setProductDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [uploadedImageForScan, setUploadedImageForScan] = useState(null);
  const [imageFileForScan, setImageFileForScan] = useState(null);
  const [uploadedImageForSearch, setUploadedImageForSearch] = useState(null);
  const [imageFileForSearch, setImageFileForSearch] = useState(null);
  const [healthRiskPercentage, setHealthRiskPercentage] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US'); // Default language
  const [selectedCurrency, setSelectedCurrency] = useState('USD'); // Default currency

  // Function to show custom modal messages instead of alert()
  const showCustomModal = (message) => {
    setModalMessage(message);
    setShowModal(true);
  };

  const convertPrice = (priceInUsd) => {
    const rate = EXCHANGE_RATES[selectedCurrency] || 1;
    return (priceInUsd * rate).toFixed(2);
  };

  const getCurrencySymbol = (currencyCode) => {
    switch (currencyCode) {
      case 'USD': return '$';
      case 'INR': return '₹';
      case 'EUR': return '€';
      default: return '';
    }
  };

  const handleSearch = async (imageSearch = false) => {
    if (!imageSearch && !productName.trim()) {
      showCustomModal('Please enter a product name or upload an image.');
      return;
    }
    if (imageSearch && !uploadedImageForSearch) {
        showCustomModal('Please upload an image for product detection.');
        return;
    }

    setLoading(true);
    setProductDetails(null);
    setScanResult(null);
    setHealthRiskPercentage(0);

    try {
      let prompt;
      let contents = [];

      // Construct the prompt based on language and input type
      let basePrompt = `Provide detailed information for the product. Include its parent company, a brief price history (since its launch with mock prices in USD), a list of 5-7 key ingredients, a general description of its content, and an analysis of which content/ingredients are generally considered good/beneficial and which might be harmful/concerning. Also, add any other necessary information for a customer. Respond in JSON format according to the schema provided.`;

      if (imageSearch) {
        prompt = `Identify the product in this image. Then, ${basePrompt} Ensure all text is in ${selectedLanguage}.`;
        contents.push({ role: "user", parts: [{ text: prompt }] });
        contents.push({
          role: "user",
          parts: [{
            inlineData: {
              mimeType: imageFileForSearch.type,
              data: uploadedImageForSearch.split(',')[1] // Get base64 data part
            }
          }]
        });
      } else {
        prompt = `${basePrompt.replace('the product', `the product "${productName}"`)} Ensure all text is in ${selectedLanguage}.`;
        contents.push({ role: "user", parts: [{ text: prompt }] });
      }

      const payload = {
        contents: contents,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              "productName": { "type": "STRING" },
              "parentCompany": { "type": "STRING" },
              "priceHistory": {
                "type": "ARRAY",
                "items": {
                  "type": "OBJECT",
                  "properties": {
                    "year": { "type": "NUMBER" },
                    "price": { "type": "STRING" } // LLM still returns string, we parse it
                  }
                }
              },
              "ingredients": {
                "type": "ARRAY",
                "items": { "type": "STRING" }
              },
              "content": { "type": "STRING" },
              "goodContent": { "type": "ARRAY", "items": { "type": "STRING" } },
              "harmfulContent": { "type": "ARRAY", "items": { "type": "STRING" } },
              "customerInfo": { "type": "STRING" }
            },
            "required": [
              "productName",
              "parentCompany",
              "priceHistory",
              "ingredients",
              "content",
              "goodContent",
              "harmfulContent",
              "customerInfo"
            ]
          }
        },
        model: "gemini-2.5-flash-preview-05-20"
      };

      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

      let response;
      let result;
      let retries = 0;
      const maxRetries = 5;
      const baseDelay = 1000;

      while (retries < maxRetries) {
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.status === 429) {
            const delay = baseDelay * Math.pow(2, retries);
            console.warn(`Rate limit hit. Retrying in ${delay / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retries++;
            continue;
          }

          result = await response.json();
          break;
        } catch (error) {
          console.error('Fetch error:', error);
          const delay = baseDelay * Math.pow(2, retries);
          console.warn(`Fetch error. Retrying in ${delay / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retries++;
        }
      }

      if (!result || !result.candidates || result.candidates.length === 0 ||
          !result.candidates[0].content || !result.candidates[0].content.parts ||
          result.candidates[0].content.parts.length === 0) {
        throw new Error('Invalid response structure from LLM.');
      }

      const jsonString = result.candidates[0].content.parts[0].text;
      const parsedData = JSON.parse(jsonString);

      // Process price history for charting: convert price string to number (in USD first)
      const processedPriceHistory = parsedData.priceHistory.map(item => ({
        year: item.year,
        // Assume LLM gives price in USD for consistent conversion
        price: parseFloat(item.price.replace(/[^0-9.]/g, ''))
      }));
      setProductDetails({ ...parsedData, priceHistory: processedPriceHistory });

      // Calculate health risk percentage
      const harmfulCount = parsedData.harmfulContent ? parsedData.harmfulContent.length : 0;
      let calculatedRisk = 0;
      if (harmfulCount > 0) {
        calculatedRisk = Math.min(harmfulCount * 20, 100);
      }
      setHealthRiskPercentage(calculatedRisk);

    } catch (error) {
      console.error('Error fetching product details:', error);
      showCustomModal(`Failed to fetch product details. Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUploadForScan = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImageFileForScan(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImageForScan(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setUploadedImageForScan(null);
      setImageFileForScan(null);
    }
  };

  const handleImageUploadForSearch = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImageFileForSearch(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImageForSearch(reader.result);
      };
      reader.readAsDataURL(file);
      setProductName('');
    } else {
      setUploadedImageForSearch(null);
      setImageFileForSearch(null);
    }
  };

  const handleScan = () => {
    if (!uploadedImageForScan) {
      showCustomModal('Please upload an image to scan.');
      return;
    }

    setLoading(true);
    setProductDetails(null);
    setScanResult(null);
    setHealthRiskPercentage(0);

    setTimeout(() => {
      const isOriginal = Math.random() > 0.5;
      setScanResult(isOriginal ? 'Original' : 'Fake');
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-xl shadow-2xl p-8 md:p-10 w-full max-w-4xl transform transition-all duration-300 hover:scale-[1.01]">
        <h1 className="text-4xl font-extrabold text-center text-gray-800 mb-8 tracking-tight">
          Product Insight Hub 🛍️
        </h1>

        {/* Global Settings */}
        <div className="mb-8 p-6 bg-gray-50 rounded-lg shadow-inner flex flex-col sm:flex-row justify-around items-center gap-4">
          <div>
            <label htmlFor="language-select" className="block text-gray-700 text-lg font-semibold mb-2">
              Select Language:
            </label>
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
            >
              <option value="en-US">English</option>
              <option value="hi-IN">Hindi</option>
              <option value="es-US">Spanish</option>
            </select>
          </div>
          <div>
            <label htmlFor="currency-select" className="block text-gray-700 text-lg font-semibold mb-2">
              Select Currency:
            </label>
            <select
              id="currency-select"
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
            >
              <option value="USD">USD ($)</option>
              <option value="INR">INR (₹)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>
        </div>

        {/* Search Section */}
        <div className="mb-8 p-6 bg-blue-50 rounded-lg shadow-inner">
          <h2 className="text-2xl font-semibold text-blue-800 mb-4">Search Product Details</h2>
          <p className="text-gray-600 mb-4">
            Enter a product name OR **upload/take a picture** of the product to get detailed information.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <input
              type="text"
              className="flex-grow p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-700 placeholder-gray-400"
              placeholder="Enter product name (e.g., 'Coca-Cola', 'iPhone 15')"
              value={productName}
              onChange={(e) => {
                setProductName(e.target.value);
                setUploadedImageForSearch(null); // Clear image if typing
                setImageFileForSearch(null);
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch(false); // Text search
                }
              }}
              disabled={uploadedImageForSearch !== null} // Disable text input if image is uploaded
            />
            <button
              onClick={() => handleSearch(false)} // Text search
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105"
              disabled={loading || !productName.trim() || uploadedImageForSearch !== null}
            >
              {loading && !scanResult && !uploadedImageForSearch ? 'Searching...' : 'Get Details (Text)'}
            </button>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="w-full border-t border-blue-200 pt-4 mt-4 text-center">
                <p className="text-gray-600 mb-2">OR</p>
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUploadForSearch}
                    className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100"
                />
                {uploadedImageForSearch && (
                  <div className="mt-4 p-2 border border-gray-300 rounded-lg bg-white shadow-sm">
                    <h3 className="text-lg font-medium text-gray-700 mb-2">Image Preview:</h3>
                    <img src={uploadedImageForSearch} alt="Product Search Preview" className="max-w-xs max-h-48 rounded-md object-contain" />
                  </div>
                )}
                <button
                    onClick={() => handleSearch(true)} // Image search
                    className="w-full mt-4 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105"
                    disabled={loading || !uploadedImageForSearch}
                >
                    {loading && uploadedImageForSearch ? 'Detecting & Getting Details...' : 'Get Details (Image)'}
                </button>
            </div>
          </div>
        </div>

        {/* Scan Section */}
        <div className="mb-8 p-6 bg-green-50 rounded-lg shadow-inner">
          <h2 className="text-2xl font-semibold text-green-800 mb-4">Check Product Authenticity</h2>
          <p className="text-gray-600 mb-4">
            **Upload/take a picture** of the product to check its authenticity.
          </p>
          <div className="flex flex-col items-center gap-4">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUploadForScan}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-green-50 file:text-green-700
                hover:file:bg-green-100"
            />
            {uploadedImageForScan && (
              <div className="mt-4 p-2 border border-gray-300 rounded-lg bg-white shadow-sm">
                <h3 className="text-lg font-medium text-gray-700 mb-2">Image Preview:</h3>
                <img src={uploadedImageForScan} alt="Product Scan Preview" className="max-w-xs max-h-48 rounded-md object-contain" />
              </div>
            )}
            <button
              onClick={handleScan}
              className="w-full px-6 py-3 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105"
              disabled={loading || !uploadedImageForScan}
            >
              {loading && scanResult ? 'Scanning...' : 'Simulate Scan Product'}
            </button>
          </div>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500"></div>
            <p className="ml-4 text-lg text-gray-600">Loading information...</p>
          </div>
        )}

        {/* Product Details Display */}
        {productDetails && !loading && (
          <div className="mt-8 p-6 bg-white border border-gray-200 rounded-lg shadow-lg">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">{productDetails.productName} Details</h2>

            {/* Health Risk Percentage */}
            <div className="mb-6 p-4 rounded-md shadow-sm bg-red-50 border border-red-200 text-center">
              <h3 className="text-xl font-semibold text-red-700 mb-2">Health Risk Assessment</h3>
              <p className="text-5xl font-extrabold text-red-800">
                {healthRiskPercentage}%
              </p>
              <p className="text-red-600 mt-2">
                (Based on potentially harmful ingredients. This is a simulated assessment.)
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 p-4 rounded-md shadow-sm">
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Parent Company</h3>
                <p className="text-gray-600">{productDetails.parentCompany}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-md shadow-sm">
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Price Over The Years</h3>
                {productDetails.priceHistory && productDetails.priceHistory.length > 0 ? (
                  <div className="w-full h-64"> {/* Set a fixed height for the chart container */}
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={productDetails.priceHistory}
                        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis tickFormatter={(value) => `${getCurrencySymbol(selectedCurrency)}${convertPrice(value)}`} />
                        <Tooltip formatter={(value) => `${getCurrencySymbol(selectedCurrency)}${convertPrice(value)}`} />
                        <Legend />
                        <Line type="monotone" dataKey="price" stroke="#8884d8" activeDot={{ r: 8 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-gray-600">No price history available.</p>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-md shadow-sm mb-6">
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Ingredients</h3>
              <ul className="list-disc list-inside text-gray-600">
                {productDetails.ingredients.map((ingredient, index) => (
                  <li key={index}>{ingredient}</li>
                ))}
              </ul>
            </div>

            <div className="bg-gray-50 p-4 rounded-md shadow-sm mb-6">
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Product Content</h3>
              <p className="text-gray-600">{productDetails.content}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-green-50 p-4 rounded-md shadow-sm border border-green-200">
                <h3 className="text-xl font-semibold text-green-700 mb-2">Good Content/Ingredients</h3>
                <ul className="list-disc list-inside text-green-600">
                  {productDetails.goodContent.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-red-50 p-4 rounded-md shadow-sm border border-red-200">
                <h3 className="text-xl font-semibold text-red-700 mb-2">Potentially Harmful Content/Ingredients</h3>
                <ul className="list-disc list-inside text-red-600">
                  {productDetails.harmfulContent.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-md shadow-sm">
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Important Customer Information</h3>
              <p className="text-gray-600">{productDetails.customerInfo}</p>
            </div>
          </div>
        )}

        {/* Scan Result Display */}
        {scanResult && !loading && (
          <div className={`mt-8 p-6 rounded-lg shadow-lg text-center ${scanResult === 'Original' ? 'bg-green-100 border-green-400' : 'bg-red-100 border-red-400'}`}>
            <h2 className="text-3xl font-bold mb-4">Authenticity Check Result:</h2>
            <p className={`text-5xl font-extrabold ${scanResult === 'Original' ? 'text-green-700' : 'text-red-700'}`}>
              {scanResult}
            </p>
            <p className="text-gray-600 mt-2">
              (This is a simulated result. Real-world authenticity checks require advanced systems.)
            </p>
          </div>
        )}

        {/* Custom Modal for Messages */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-80 max-w-sm text-center">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Notification</h3>
              <p className="text-gray-600 mb-6">{modalMessage}</p>
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
