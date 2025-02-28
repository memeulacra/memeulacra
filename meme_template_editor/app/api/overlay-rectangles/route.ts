import { NextResponse } from "next/server";

// Create a simple logger
const logger = {
  info: (message: string) => {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`)
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, error || '')
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    logger.info(`Received request to overlay rectangles on image: ${data.image_url?.substring(0, 50)}...`);
    
    // Forward the request to the FastAPI backend
    logger.info("Forwarding request to API backend");
    const response = await fetch("http://api:8000/overlay-rectangles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Error from API: ${response.status} ${errorText}`);
      return NextResponse.json(
        { error: "Failed to generate rectangle overlay" },
        { status: response.status }
      );
    }
    
    const result = await response.json();
    logger.info(`Successfully generated rectangle overlay: ${result.image_url}`);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("Error in overlay-rectangles proxy:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
