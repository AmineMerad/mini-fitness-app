import axios, { AxiosError } from 'axios';

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Using GPT-4o (cheap, fast, excellent vision capabilities)
// Cost: ~$2.50 per 1M input tokens, $10 per 1M output tokens
const OPENROUTER_MODEL = 'openai/gpt-4o-mini';
const REQUEST_TIMEOUT = 30000; // 30 seconds (vision models need more time)
const MAX_RETRIES = 2;

interface FoodItem {
  food_name: string;
  portion: string;
  calories: number;
  confidence?: number;
}

interface AnalysisResult {
  success: boolean;
  items?: FoodItem[];
  totalCalories?: number;
  error?: string;
}

/**
 * Analyzes a meal photo using OpenRouter's Claude 3.5 Sonnet vision model
 * @param imageUrl - The CDN URL of the meal photo
 * @returns Promise with analysis result containing food items and total calories
 */
export async function analyzeMealPhoto(imageUrl: string): Promise<AnalysisResult> {
  // Check if running in mock mode (no API key configured)
  const useMock = !process.env['OPENROUTER_API_KEY'] ||
                  process.env['OPENROUTER_API_KEY'] === 'your_openrouter_api_key_here';

  if (useMock) {
    console.log('[OCR] Running in MOCK mode (no API key configured)');
    return analyzeMealPhotoMock(imageUrl);
  }

  console.log(`[OCR] Analyzing meal photo with OpenRouter: ${imageUrl}`);

  let lastError: string = 'Unknown error';

  // Retry logic: max 2 retries
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await callOpenRouterAPI(imageUrl);
      console.log(`[OCR] Success! Detected ${result.items?.length || 0} food items, ${result.totalCalories || 0} total calories`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'API request failed';
      console.error(`[OCR] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError);

      // Don't retry on the last attempt
      if (attempt < MAX_RETRIES) {
        // Wait before retrying (exponential backoff: 1s, 2s)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  console.error(`[OCR] All attempts failed. Last error: ${lastError}`);
  return {
    success: false,
    error: `Failed after ${MAX_RETRIES + 1} attempts: ${lastError}`
  };
}

/**
 * Calls OpenRouter API to analyze meal photo
 */
async function callOpenRouterAPI(imageUrl: string): Promise<AnalysisResult> {
  try {
    console.log(`[OCR] Sending request to OpenRouter API with model: ${OPENROUTER_MODEL}`);

    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              },
              {
                type: 'text',
                text: `You are a nutrition expert. Analyze this meal photo and identify ALL visible food items.

For EACH food item you see, provide:
1. food_name: The specific name of the food (e.g., "Grilled Chicken Breast", "Brown Rice", "Steamed Broccoli")
2. portion: Estimated portion size with unit (e.g., "150g", "1 cup", "2 slices")
3. calories: Estimated calories as a number (e.g., 250)

IMPORTANT:
- If you see food in the image, you MUST identify at least 1-3 items
- Be as accurate as possible with calorie estimates
- Return ONLY a JSON array in this exact format: [{"food_name": "...", "portion": "...", "calories": 200}]
- Do NOT include any explanation, just the JSON array
- If you truly cannot identify any food, return an empty array: []`
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.3 // Lower temperature for more consistent output
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env['OPENROUTER_API_KEY']}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://fitness-app.example.com', // Optional
          'X-Title': 'Mini Fitness App' // Optional
        },
        timeout: REQUEST_TIMEOUT
      }
    );

    console.log(`[OCR] Received response from OpenRouter API (status: ${response.status})`);

    // Parse the response
    const content = response.data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[OCR] No content in API response:', response.data);
      throw new Error('No content in API response');
    }

    console.log(`[OCR] API response content: ${content.substring(0, 200)}...`);

    // Extract JSON from the response (handle markdown code blocks)
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                     content.match(/(\[[\s\S]*\])/);

    if (!jsonMatch) {
      throw new Error('Could not extract JSON from response');
    }

    const foodItems: FoodItem[] = JSON.parse(jsonMatch[1]);

    // Validate the response structure
    if (!Array.isArray(foodItems)) {
      throw new Error('Invalid response format: expected array of food items');
    }

    // If empty array, it means no food was detected
    if (foodItems.length === 0) {
      console.log('[OCR] No food items detected in the image');
      return {
        success: false,
        error: 'No food items detected in the image. Please ensure the image contains visible food.'
      };
    }

    // Add confidence score (OpenRouter doesn't provide this, so we'll use a default)
    const itemsWithConfidence = foodItems.map(item => ({
      ...item,
      confidence: 0.85 // Default confidence for vision model
    }));

    // Calculate total calories
    const totalCalories = foodItems.reduce((sum, item) => sum + (item.calories || 0), 0);

    return {
      success: true,
      items: itemsWithConfidence,
      totalCalories
    };

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.code === 'ECONNABORTED') {
        console.error('[OCR] Request timeout after 10 seconds');
        throw new Error('Request timeout');
      }
      if (axiosError.response) {
        console.error('[OCR] API error response:', {
          status: axiosError.response.status,
          statusText: axiosError.response.statusText,
          data: axiosError.response.data
        });
        throw new Error(`API error: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`);
      }
      console.error('[OCR] Network error:', axiosError.message);
      throw new Error(`Network error: ${axiosError.message}`);
    }

    if (error instanceof SyntaxError) {
      console.error('[OCR] Failed to parse JSON from API response');
      throw new Error('Failed to parse API response');
    }

    console.error('[OCR] Unexpected error:', error);
    throw error;
  }
}

/**
 * Mock analysis function for testing (returns fake food data)
 * @param imageUrl - The CDN URL of the meal photo
 * @returns Promise with mock analysis result
 */
export async function analyzeMealPhotoMock(imageUrl: string): Promise<AnalysisResult> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log(`[MOCK] Analyzing meal photo: ${imageUrl}`);

  // Return fake food data
  const mockItems: FoodItem[] = [
    {
      food_name: 'Grilled Chicken Breast',
      portion: '150g',
      calories: 248,
      confidence: 0.92
    },
    {
      food_name: 'Brown Rice',
      portion: '100g',
      calories: 112,
      confidence: 0.88
    },
    {
      food_name: 'Steamed Broccoli',
      portion: '100g',
      calories: 34,
      confidence: 0.85
    }
  ];

  const totalCalories = mockItems.reduce((sum, item) => sum + item.calories, 0);

  return {
    success: true,
    items: mockItems,
    totalCalories
  };
}
