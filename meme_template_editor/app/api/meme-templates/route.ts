import { NextResponse } from "next/server"
import pool from "@/lib/db"

export async function GET() {
  try {
    const result = await pool.query("SELECT id, name, image_url, text_box_coordinates FROM meme_templates")
    
    // Process the results to handle the JSONB[] format
    const processedRows = result.rows.map(row => {
      // If text_box_coordinates is an array of JSONB, parse the first element
      if (row.text_box_coordinates && Array.isArray(row.text_box_coordinates) && row.text_box_coordinates.length > 0) {
        try {
          // If it's already a string, parse it, otherwise use as is
          if (typeof row.text_box_coordinates[0] === 'string') {
            row.text_box_coordinates = JSON.parse(row.text_box_coordinates[0]);
          } else {
            row.text_box_coordinates = row.text_box_coordinates[0];
          }
        } catch (e) {
          console.error("Error parsing text_box_coordinates:", e);
          row.text_box_coordinates = [];
        }
      } else {
        row.text_box_coordinates = [];
      }
      return row;
    });
    
    return NextResponse.json(processedRows)
  } catch (error) {
    console.error("Error fetching meme templates:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
