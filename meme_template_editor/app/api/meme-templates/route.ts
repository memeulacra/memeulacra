import { NextResponse } from "next/server"
import pool from "@/lib/db"

// Define the structure of a meme template
interface MemeTemplate {
  id: string;
  name: string;
  image_url: string;
  text_box_coordinates: any;
}

// Create a simple logger
const logger = {
  info: (message: string) => {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`)
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, error || '')
  }
}

export async function GET() {
  logger.info("GET /api/meme-templates - Fetching all meme templates")
  try {
    logger.info("Executing database query for meme templates")
    const result = await pool.query("SELECT id, name, image_url, text_box_coordinates FROM meme_templates")
    logger.info(`Retrieved ${result.rows.length} meme templates from database`)
    
    // Process the results to handle the JSONB[] format
    const processedRows = result.rows.map((row: any) => {
      // Log the image URL for debugging
      logger.info(`Template ${row.id} (${row.name}) has image_url: ${row.image_url}`)
      
      // Check if image_url is a relative path and convert to full CDN URL if needed
      if (row.image_url && row.image_url.startsWith('/')) {
        logger.info(`Converting relative URL ${row.image_url} to full CDN URL`)
        // Use the Digital Ocean CDN URL
        row.image_url = `https://memulacra.nyc3.digitaloceanspaces.com${row.image_url}`
        logger.info(`Converted to: ${row.image_url}`)
      }
      
      // If text_box_coordinates is an array of JSONB, parse the first element
      if (row.text_box_coordinates && Array.isArray(row.text_box_coordinates) && row.text_box_coordinates.length > 0) {
        try {
          // If it's already a string, parse it, otherwise use as is
          if (typeof row.text_box_coordinates[0] === 'string') {
            logger.info(`Parsing text_box_coordinates as string for template ${row.id}`)
            const parsedCoordinates = JSON.parse(row.text_box_coordinates[0]);
            
            // Check if the parsed result is a string that looks like an array (starts with '[')
            if (typeof parsedCoordinates === 'string' && parsedCoordinates.trim().startsWith('[')) {
              logger.info(`Detected nested JSON array string for template ${row.id}, parsing again`)
              try {
                // Parse the string again to get the actual array
                row.text_box_coordinates = JSON.parse(parsedCoordinates);
                logger.info(`Successfully parsed nested JSON for template ${row.id}: ${JSON.stringify(row.text_box_coordinates)}`)
              } catch (nestedError) {
                logger.error(`Error parsing nested JSON for template ${row.id}:`, nestedError);
                row.text_box_coordinates = [];
              }
            } else {
              // If it's not a nested string, use the parsed result directly
              row.text_box_coordinates = parsedCoordinates;
              logger.info(`Using parsed coordinates for template ${row.id}: ${JSON.stringify(row.text_box_coordinates)}`)
            }
          } else {
            logger.info(`Using text_box_coordinates as object for template ${row.id}`)
            const coordinates = row.text_box_coordinates[0];
            
            // Check if the object might be a stringified JSON array
            if (typeof coordinates === 'string' && coordinates.trim().startsWith('[')) {
              logger.info(`Detected JSON array string in object for template ${row.id}, parsing`)
              try {
                row.text_box_coordinates = JSON.parse(coordinates);
                logger.info(`Successfully parsed JSON string from object for template ${row.id}`)
              } catch (objError) {
                logger.error(`Error parsing JSON string from object for template ${row.id}:`, objError);
                row.text_box_coordinates = [];
              }
            } else {
              row.text_box_coordinates = coordinates;
            }
          }
        } catch (e) {
          logger.error(`Error parsing text_box_coordinates for template ${row.id}:`, e);
          row.text_box_coordinates = [];
        }
      } else {
        logger.info(`No text_box_coordinates found for template ${row.id}`)
        row.text_box_coordinates = [];
      }
      return row;
    });
    
    logger.info("Successfully processed all meme templates, returning response")
    return NextResponse.json(processedRows)
  } catch (error) {
    logger.error("Error fetching meme templates:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
