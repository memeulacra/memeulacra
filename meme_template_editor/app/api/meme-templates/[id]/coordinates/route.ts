import { NextResponse } from "next/server"
import pool from "@/lib/db"

// Create a simple logger
const logger = {
  info: (message: string) => {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`)
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, error || '')
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { id } = params
  logger.info(`DELETE /api/meme-templates/${id}/coordinates - Clearing coordinates`)
  
  try {
    // First check if the meme template exists
    logger.info(`Checking if template ${id} exists`)
    const checkResult = await pool.query(
      "SELECT id FROM meme_templates WHERE id = $1",
      [id]
    )
    
    if (checkResult.rows.length === 0) {
      logger.error(`Template ${id} not found`)
      return NextResponse.json({ error: "Meme template not found" }, { status: 404 })
    }

    logger.info(`Template ${id} found, clearing coordinates and text_box_count`)
    
    // Clear both text_box_coordinates and text_box_count
    await pool.query(
      "UPDATE meme_templates SET text_box_coordinates = NULL, text_box_count = 0 WHERE id = $1", 
      [id]
    )
    
    logger.info(`Coordinates for template ${id} cleared successfully`)
    return NextResponse.json({ message: "Coordinates cleared successfully" })
  } catch (error) {
    logger.error(`Error clearing coordinates for template ${id}:`, error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { id } = params
  logger.info(`PUT /api/meme-templates/${id}/coordinates - Updating coordinates`)
  
  try {
    const body = await request.json()
    const { coordinates } = body
    
    logger.info(`Received coordinates for template ${id}: ${JSON.stringify(coordinates)}`)

    // First check if the meme template already has text_box_coordinates
    logger.info(`Checking if template ${id} exists`)
    const checkResult = await pool.query(
      "SELECT text_box_coordinates FROM meme_templates WHERE id = $1",
      [id]
    )
    
    if (checkResult.rows.length === 0) {
      logger.error(`Template ${id} not found`)
      return NextResponse.json({ error: "Meme template not found" }, { status: 404 })
    }

    logger.info(`Template ${id} found, updating coordinates`)
    
    // Update the text_box_coordinates field with the new coordinates
    // The database expects a JSONB[] array, so we wrap the coordinates in an array
    const jsonCoordinates = JSON.stringify(coordinates)
    logger.info(`Saving coordinates as JSON: ${jsonCoordinates}`)
    logger.info(`Updating text_box_count to: ${coordinates.length}`)
    
    await pool.query(
      "UPDATE meme_templates SET text_box_coordinates = $1, text_box_count = $2 WHERE id = $3", 
      [
        [jsonCoordinates], // Wrap in array to match JSONB[] type
        coordinates.length, // Set text_box_count to the number of text boxes
        id,
      ]
    )
    
    logger.info(`Coordinates for template ${id} updated successfully`)
    return NextResponse.json({ message: "Coordinates updated successfully" })
  } catch (error) {
    logger.error(`Error updating coordinates for template ${id}:`, error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
