"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Download } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"

interface Box {
  id: number
  x: number
  y: number
  width: number
  height: number
}

interface MemeTemplate {
  id: string
  name: string
  image_url: string
  text_box_coordinates: Box[] | null
}

export default function MemeEditor() {
  const [templates, setTemplates] = useState<MemeTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<MemeTemplate | null>(null)
  const [boxes, setBoxes] = useState<Box[]>([])
  const [activeBox, setActiveBox] = useState<number | null>(null)
  const [resizing, setResizing] = useState<"move" | "nw" | "ne" | "sw" | "se" | null>(null)
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchMemeTemplates()
  }, [])

  const fetchMemeTemplates = async () => {
    try {
      const response = await fetch("/api/meme-templates")
      if (response.ok) {
        const data = await response.json()
        setTemplates(data)
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch meme templates",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching meme templates:", error)
      toast({
        title: "Error",
        description: "An error occurred while fetching meme templates",
        variant: "destructive",
      })
    }
  }

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setSelectedTemplate(template)
      // Handle both array and JSONB array formats
      if (template.text_box_coordinates) {
        setBoxes(template.text_box_coordinates)
      } else {
        setBoxes([])
      }
    }
  }

  const addBox = () => {
    const newBox: Box = {
      id: boxes.length + 1,
      x: 10,
      y: 10,
      width: 20,
      height: 10,
    }
    setBoxes([...boxes, newBox])
  }

  const updateBox = (id: number, updates: Partial<Box>) => {
    setBoxes(boxes.map((box) => (box.id === id ? { ...box, ...updates } : box)))
  }

  const handleMouseDown = (id: number, action: "move" | "nw" | "ne" | "sw" | "se") => (e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveBox(id)
    setResizing(action)
    setStartPos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (activeBox === null || !containerRef.current || !startPos) return

    const container = containerRef.current.getBoundingClientRect()
    const deltaX = ((e.clientX - startPos.x) / container.width) * 100
    const deltaY = ((e.clientY - startPos.y) / container.height) * 100

    const activeBoxData = boxes.find((box) => box.id === activeBox)
    if (!activeBoxData) return

    let newBox: Partial<Box> = {}

    switch (resizing) {
      case "move":
        newBox = {
          x: activeBoxData.x + deltaX,
          y: activeBoxData.y + deltaY,
        }
        break
      case "nw":
        newBox = {
          x: activeBoxData.x + deltaX,
          y: activeBoxData.y + deltaY,
          width: activeBoxData.width - deltaX,
          height: activeBoxData.height - deltaY,
        }
        break
      case "ne":
        newBox = {
          y: activeBoxData.y + deltaY,
          width: activeBoxData.width + deltaX,
          height: activeBoxData.height - deltaY,
        }
        break
      case "sw":
        newBox = {
          x: activeBoxData.x + deltaX,
          width: activeBoxData.width - deltaX,
          height: activeBoxData.height + deltaY,
        }
        break
      case "se":
        newBox = {
          width: activeBoxData.width + deltaX,
          height: activeBoxData.height + deltaY,
        }
        break
    }

    // Ensure box dimensions don't go below a minimum size
    if (newBox.width !== undefined && newBox.width < 5) newBox.width = 5
    if (newBox.height !== undefined && newBox.height < 5) newBox.height = 5

    // Ensure box stays within container bounds
    if (newBox.x !== undefined) newBox.x = Math.max(0, Math.min(newBox.x, 100 - (newBox.width || activeBoxData.width)))
    if (newBox.y !== undefined)
      newBox.y = Math.max(0, Math.min(newBox.y, 100 - (newBox.height || activeBoxData.height)))

    updateBox(activeBox, newBox)
    setStartPos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseUp = () => {
    setActiveBox(null)
    setResizing(null)
    setStartPos(null)
  }

  const saveBoxCoordinates = async () => {
    if (!selectedTemplate) return

    try {
      const response = await fetch(`/api/meme-templates/${selectedTemplate.id}/coordinates`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ coordinates: boxes }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Coordinates saved successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to save coordinates",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error saving coordinates:", error)
      toast({
        title: "Error",
        description: "An error occurred while saving coordinates",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Meme Box Editor</h1>
      <div className="mb-4">
        <Select onValueChange={handleTemplateChange}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select a meme template" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selectedTemplate && (
        <div
          ref={containerRef}
          className="relative border border-gray-300 mb-4"
          style={{ width: "100%", height: "500px" }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={selectedTemplate.image_url || "/placeholder.svg"}
            alt="Meme"
            className="w-full h-full object-contain"
          />
          {boxes.map((box) => (
            <div
              key={box.id}
              className="absolute border-2 border-blue-500 flex items-center justify-center"
              style={{
                left: `${box.x}%`,
                top: `${box.y}%`,
                width: `${box.width}%`,
                height: `${box.height}%`,
                cursor: activeBox === box.id && resizing === "move" ? "move" : "default",
              }}
              onMouseDown={handleMouseDown(box.id, "move")}
            >
              <span className="text-blue-500 font-bold text-lg select-none">{box.id}</span>
              <div
                className="absolute top-0 left-0 w-4 h-4 bg-blue-500 cursor-nw-resize"
                onMouseDown={handleMouseDown(box.id, "nw")}
              />
              <div
                className="absolute top-0 right-0 w-4 h-4 bg-blue-500 cursor-ne-resize"
                onMouseDown={handleMouseDown(box.id, "ne")}
              />
              <div
                className="absolute bottom-0 left-0 w-4 h-4 bg-blue-500 cursor-sw-resize"
                onMouseDown={handleMouseDown(box.id, "sw")}
              />
              <div
                className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize"
                onMouseDown={handleMouseDown(box.id, "se")}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between">
        <Button onClick={addBox}>
          <Plus className="mr-2 h-4 w-4" /> Add Box
        </Button>
        <Button onClick={saveBoxCoordinates}>
          <Download className="mr-2 h-4 w-4" /> Save Box Coordinates
        </Button>
      </div>
    </div>
  )
}
