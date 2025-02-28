import { NextResponse } from "next/server"

// Create a simple logger
const logger = {
  info: (message: string) => {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`)
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, error || '')
  }
}

export async function GET(request: Request) {
  try {
    // Get the URL from the query parameters
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')
    
    if (!path) {
      logger.error("No path provided to meme-proxy")
      return NextResponse.json({ error: "No path provided" }, { status: 400 })
    }
    
    logger.info(`Proxying request for path: ${path}`)
    
    // Determine the full URL based on the path
    let fullUrl: string
    
    // If it already has a domain, use it as is
    if (path.startsWith('http')) {
      fullUrl = path
      logger.info(`Using provided URL: ${fullUrl}`)
    }
    // If it's a path that includes 'memes/', ensure it's constructed correctly
    else if (path.includes('memes/')) {
      // Check if it's a full path or just the filename part
      if (path.startsWith('/memes/')) {
        fullUrl = `https://memulacra.nyc3.digitaloceanspaces.com${path}`
      } else {
        fullUrl = `https://memulacra.nyc3.digitaloceanspaces.com/memes/${path.replace('memes/', '')}`
      }
      logger.info(`Converting memes path to CDN URL: ${fullUrl}`)
    }
    // If it's a relative path, convert to Digital Ocean CDN URL
    else if (path.startsWith('/')) {
      fullUrl = `https://memulacra.nyc3.digitaloceanspaces.com${path}`
      logger.info(`Converting relative path to CDN URL: ${fullUrl}`)
    } 
    // If it's just a filename, assume it's in the root folder
    else {
      fullUrl = `https://memulacra.nyc3.digitaloceanspaces.com/${path}`
      logger.info(`Converting filename to CDN URL: ${fullUrl}`)
    }
    
    // Fetch the image from the CDN
    logger.info(`Fetching image from: ${fullUrl}`)
    const response = await fetch(fullUrl)
    
    if (!response.ok) {
      logger.error(`Failed to fetch image: ${response.status} ${response.statusText}`)
      
      // Try an alternative URL if the first one fails
      if (fullUrl.includes('memes.supertech.ai')) {
        const altUrl = fullUrl.replace('https://memes.supertech.ai', 'https://memulacra.nyc3.digitaloceanspaces.com')
        logger.info(`Trying alternative URL: ${altUrl}`)
        
        const altResponse = await fetch(altUrl)
        if (!altResponse.ok) {
          logger.error(`Alternative URL also failed: ${altResponse.status} ${altResponse.statusText}`)
          return NextResponse.json({ error: "Failed to fetch image" }, { status: 404 })
        }
        
        // Return the image from the alternative URL
        logger.info(`Successfully fetched image from alternative URL`)
        const imageBuffer = await altResponse.arrayBuffer()
        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': altResponse.headers.get('Content-Type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400'
          }
        })
      }
      
      return NextResponse.json({ error: "Failed to fetch image" }, { status: 404 })
    }
    
    // Return the image
    logger.info(`Successfully fetched image, returning to client`)
    const imageBuffer = await response.arrayBuffer()
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400'
      }
    })
    
  } catch (error) {
    logger.error("Error in meme-proxy:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
