import { NextResponse } from "next/server"
import pool from "@/lib/db"

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { id } = params
  const { coordinates } = await request.json()

  try {
    // First check if the meme template already has text_box_coordinates
    const checkResult = await pool.query(
      "SELECT text_box_coordinates FROM meme_templates WHERE id = $1",
      [id]
    )
    
    if (checkResult.rows.length === 0) {
      return NextResponse.json({ error: "Meme template not found" }, { status: 404 })
    }

    // Update the text_box_coordinates field with the new coordinates
    // The database expects a JSONB[] array, so we wrap the coordinates in an array
    await pool.query("UPDATE meme_templates SET text_box_coordinates = $1 WHERE id = $2", [
      [JSON.stringify(coordinates)], // Wrap in array to match JSONB[] type
      id,
    ])
    
    return NextResponse.json({ message: "Coordinates updated successfully" })
  } catch (error) {
    console.error("Error updating coordinates:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
