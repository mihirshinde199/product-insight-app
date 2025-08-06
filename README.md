# Product Insight Hub

This is a React application that allows users to search for product details either by entering the product name or by uploading/taking a picture of the product. It provides information such as the parent company, price history (displayed in a line graph), ingredients, content analysis (identifying good vs. harmful components), and a simulated authenticity check. Users can also select the language for the product information and the currency for price display.

## Features

* **Product Search**: Get detailed information by text input or image upload/capture.
* **Image Detection**: Utilizes an LLM to identify products from uploaded images.
* **Price History Graph**: Visualizes product price trends since launch, with currency conversion.
* **Ingredient Analysis**: Highlights beneficial and potentially harmful ingredients.
* **Health Risk Assessment**: Displays a simulated health risk percentage based on harmful content.
* **Product Authenticity Check**: A simulated feature to determine if a product is original or fake via image upload/capture.
* **Multi-language Support**: View product details in English, Hindi, or Spanish.
* **Multi-currency Support**: Display prices in USD, INR, or EUR.

## Setup Instructions

To get this project up and running on your local machine, follow these steps:

### Prerequisites

* Node.js (LTS version recommended)
* npm or yarn

### Installation

1.  **Clone the repository (if applicable):**
    ```bash
    git clone <your-repo-url>
    cd my-product-insight-app
    ```
    (If you don't have a repo, you would create a new React app and then copy the source code into it.)

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Environment Variables:**
    This application interacts with the Google Gemini API. You will need an API key.
    Create a file named `.env` in the root directory of your project (same level as `package.json`).
    Copy the contents of `.env.example` into your new `.env` file and replace `YOUR_GEMINI_API_KEY` with your actual API key.

    ```
    # .env
    REACT_APP_GEMINI_API_KEY=YOUR_GEMINI_API_KEY
    ```
    **Note**: For this specific Canvas environment, the API key is automatically provided at runtime, so this step is more for a standard local development setup.

## Running the Application

1.  **Start the development server:**
    ```bash
    npm start
    # or
    yarn start
    ```
    This will open the application in your default web browser at `http://localhost:3000`.

## Important Notes

* **API Key**: The application uses the Google Gemini API for product information and image understanding. Ensure your API key is correctly configured.
* **Simulated Features**: The "Authenticity Check" and the "Health Risk Assessment" are simulated for demonstration purposes. Real-world implementations would require extensive backend systems, large datasets, and advanced machine learning models.
* **Currency Exchange Rates**: The currency exchange rates are hardcoded for demonstration. For a production application, you would integrate with a real-time currency exchange API.
