"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Download, Trash2, Layers } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"

interface Box {
  id: number
  x: number
  y: number
  width: number
  height: number
  label?: string // Label for the text box
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
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [logMessages, setLogMessages] = useState<string[]>([])
  const [imageLoaded, setImageLoaded] = useState<boolean>(false)
  const [overlayImageUrl, setOverlayImageUrl] = useState<string | null>(null)
  const [imageDimensions, setImageDimensions] = useState<{
    naturalWidth: number
    naturalHeight: number
    renderedWidth: number
    renderedHeight: number
    offsetX: number
    offsetY: number
  } | null>(null)

  // Add a logging function
  const log = (message: string) => {
    console.log(message)
    setLogMessages(prev => [...prev, `${new Date().toISOString()}: ${message}`])
  }

  // Function to convert container coordinates to image coordinates
  const containerToImageCoordinates = (box: Box): Box => {
    if (!imageDimensions) return box

    const { renderedWidth, renderedHeight, offsetX, offsetY } = imageDimensions
    const containerWidth = containerRef.current?.clientWidth || 0
    const containerHeight = containerRef.current?.clientHeight || 0

    // Calculate the scaling factors
    const scaleX = 100 / (renderedWidth / containerWidth * 100)
    const scaleY = 100 / (renderedHeight / containerHeight * 100)

    // Calculate the offsets as percentages of the container
    const offsetXPercent = (offsetX / containerWidth) * 100
    const offsetYPercent = (offsetY / containerHeight) * 100

    // Transform the coordinates
    return {
      ...box,
      x: (box.x - offsetXPercent) * scaleX,
      y: (box.y - offsetYPercent) * scaleY,
      width: box.width * scaleX,
      height: box.height * scaleY
    }
  }

  // Function to convert image coordinates to container coordinates
  const imageToContainerCoordinates = (box: Box): Box => {
    if (!imageDimensions) return box

    const { renderedWidth, renderedHeight, offsetX, offsetY } = imageDimensions
    const containerWidth = containerRef.current?.clientWidth || 0
    const containerHeight = containerRef.current?.clientHeight || 0

    // Calculate the scaling factors
    const scaleX = (renderedWidth / containerWidth * 100) / 100
    const scaleY = (renderedHeight / containerHeight * 100) / 100

    // Calculate the offsets as percentages of the container
    const offsetXPercent = (offsetX / containerWidth) * 100
    const offsetYPercent = (offsetY / containerHeight) * 100

    // Transform the coordinates
    return {
      ...box,
      x: box.x * scaleX + offsetXPercent,
      y: box.y * scaleY + offsetYPercent,
      width: box.width * scaleX,
      height: box.height * scaleY
    }
  }

  // Function to update image dimensions when the image is loaded or resized
  const updateImageDimensions = () => {
    if (!containerRef.current) return
    
    const container = containerRef.current
    const img = container.querySelector('img')
    
    if (!img) return
    
    const containerRect = container.getBoundingClientRect()
    const imgRect = img.getBoundingClientRect()
    
    setImageDimensions({
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      renderedWidth: imgRect.width,
      renderedHeight: imgRect.height,
      offsetX: imgRect.left - containerRect.left,
      offsetY: imgRect.top - containerRect.top
    })
    
    log(`Image dimensions updated: natural=${img.naturalWidth}x${img.naturalHeight}, rendered=${imgRect.width}x${imgRect.height}, offset=(${imgRect.left - containerRect.left},${imgRect.top - containerRect.top})`)
  }

  useEffect(() => {
    log("Component mounted, fetching meme templates")
    fetchMemeTemplates()
    
    // Add window resize listener to update image dimensions
    window.addEventListener('resize', updateImageDimensions)
    return () => {
      window.removeEventListener('resize', updateImageDimensions)
    }
  }, [])

  const fetchMemeTemplates = async () => {
    try {
      log("Fetching meme templates from API")
      const response = await fetch("/api/meme-templates")
      if (response.ok) {
        const data = await response.json()
        log(`Successfully fetched ${data.length} meme templates`)
        setTemplates(data)
      } else {
        const errorText = await response.text()
        log(`Failed to fetch meme templates: ${response.status} ${errorText}`)
        toast({
          title: "Error",
          description: "Failed to fetch meme templates",
          variant: "destructive",
        })
      }
    } catch (error) {
      log(`Error fetching meme templates: ${error}`)
      console.error("Error fetching meme templates:", error)
      toast({
        title: "Error",
        description: "An error occurred while fetching meme templates",
        variant: "destructive",
      })
    }
  }

  const handleTemplateChange = async (templateId: string) => {
    log(`Template selected: ${templateId}, fetching latest data`)
    
    // Reset imageLoaded state when switching templates
    setImageLoaded(false)
    setImageDimensions(null)
    
    try {
      // Fetch the latest data for this template to ensure we have the most up-to-date coordinates
      const response = await fetch(`/api/meme-templates/${templateId}`)
      
      if (response.ok) {
        const template = await response.json()
        log(`Fetched latest data for template: ${template.name} (${template.id})`)
        log(`Template image URL: ${template.image_url}`)
        
        setSelectedTemplate(template)
        
        // Handle both array and JSONB array formats
        if (template.text_box_coordinates) {
          log(`Template has ${template.text_box_coordinates.length} text box coordinates`)
          log(`Text box coordinates data: ${JSON.stringify(template.text_box_coordinates)}`)
          setBoxes(template.text_box_coordinates)
        } else {
          log("Template has no text box coordinates, initializing empty array")
          setBoxes([])
        }
      } else {
        // If we can't fetch the latest data, fall back to the cached data
        log(`Failed to fetch latest data for template ${templateId}, falling back to cached data`)
        const cachedTemplate = templates.find((t) => t.id === templateId)
        
        if (cachedTemplate) {
          log(`Using cached data for template: ${cachedTemplate.name} (${cachedTemplate.id})`)
          log(`Template image URL: ${cachedTemplate.image_url}`)
          
          setSelectedTemplate(cachedTemplate)
          
          // Handle both array and JSONB array formats
          if (cachedTemplate.text_box_coordinates) {
            log(`Template has ${cachedTemplate.text_box_coordinates.length} text box coordinates`)
            log(`Text box coordinates data: ${JSON.stringify(cachedTemplate.text_box_coordinates)}`)
            setBoxes(cachedTemplate.text_box_coordinates)
          } else {
            log("Template has no text box coordinates, initializing empty array")
            setBoxes([])
          }
        }
      }
    } catch (error) {
      log(`Error fetching template data: ${error}`)
      
      // Fall back to cached data on error
      const cachedTemplate = templates.find((t) => t.id === templateId)
      if (cachedTemplate) {
        log(`Using cached data for template due to error: ${cachedTemplate.name} (${cachedTemplate.id})`)
        setSelectedTemplate(cachedTemplate)
        
        if (cachedTemplate.text_box_coordinates) {
          log(`Template has ${cachedTemplate.text_box_coordinates.length} text box coordinates`)
          setBoxes(cachedTemplate.text_box_coordinates)
        } else {
          log("Template has no text box coordinates, initializing empty array")
          setBoxes([])
        }
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
      label: "", // Initialize with empty label
    }
    log(`Adding new box with id ${newBox.id}`)
    setBoxes([...boxes, newBox])
  }

  const updateBox = (id: number, updates: Partial<Box>) => {
    log(`Updating box ${id} with: ${JSON.stringify(updates)}`)
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
      setIsLoading(true)
      
      // Convert container coordinates to image coordinates before saving
      const imageCoordinates = boxes.map(box => containerToImageCoordinates(box))
      
      log(`Saving coordinates for template ${selectedTemplate.id}`)
      log(`Original box data: ${JSON.stringify(boxes)}`)
      log(`Transformed box data: ${JSON.stringify(imageCoordinates)}`)
      
      const response = await fetch(`/api/meme-templates/${selectedTemplate.id}/coordinates`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ coordinates: imageCoordinates }),
      })

      if (response.ok) {
        log("Coordinates saved successfully")
        toast({
          title: "Success",
          description: "Coordinates saved successfully",
        })
      } else {
        const errorText = await response.text()
        log(`Failed to save coordinates: ${response.status} ${errorText}`)
        toast({
          title: "Error",
          description: "Failed to save coordinates",
          variant: "destructive",
        })
      }
    } catch (error) {
      log(`Error saving coordinates: ${error}`)
      console.error("Error saving coordinates:", error)
      toast({
        title: "Error",
        description: "An error occurred while saving coordinates",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const clearTextBoxes = async () => {
    if (!selectedTemplate) return

    try {
      setIsLoading(true)
      log(`Clearing text boxes for template ${selectedTemplate.id}`)
      
      const response = await fetch(`/api/meme-templates/${selectedTemplate.id}/coordinates`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        }
      })

      if (response.ok) {
        log("Text boxes cleared successfully")
        // Clear the boxes in the UI
        setBoxes([])
        toast({
          title: "Success",
          description: "Text boxes cleared successfully",
        })
      } else {
        const errorText = await response.text()
        log(`Failed to clear text boxes: ${response.status} ${errorText}`)
        toast({
          title: "Error",
          description: "Failed to clear text boxes",
          variant: "destructive",
        })
      }
    } catch (error) {
      log(`Error clearing text boxes: ${error}`)
      console.error("Error clearing text boxes:", error)
      toast({
        title: "Error",
        description: "An error occurred while clearing text boxes",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const testRectangleOverlay = async () => {
    if (!selectedTemplate || boxes.length === 0) {
      toast({
        title: "Error",
        description: "Please select a template and add at least one text box",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      log("Testing rectangle overlay");
      
      // Get the image URL (either proxy or direct)
      const imageUrl = selectedTemplate.image_url;
      
      // Convert container coordinates to image coordinates before sending to API
      const imageCoordinates = boxes.map(box => containerToImageCoordinates(box));
      
      // Prepare the request data
      const requestData = {
        image_url: imageUrl,
        boxes_data: imageCoordinates
      };
      
      log(`Sending overlay request with image URL: ${imageUrl}`);
      log(`Original boxes data: ${JSON.stringify(boxes)}`);
      log(`Transformed boxes data: ${JSON.stringify(imageCoordinates)}`);
      
      // Call the API
      const response = await fetch("/api/overlay-rectangles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });
      
      if (response.ok) {
        const data = await response.json();
        log(`Received overlay image URL: ${data.image_url}`);
        setOverlayImageUrl(data.image_url);
        toast({
          title: "Success",
          description: "Rectangle overlay generated successfully",
        });
      } else {
        const errorText = await response.text();
        log(`Failed to generate rectangle overlay: ${response.status} ${errorText}`);
        toast({
          title: "Error",
          description: "Failed to generate rectangle overlay",
          variant: "destructive",
        });
      }
    } catch (error) {
      log(`Error generating rectangle overlay: ${error}`);
      console.error("Error generating rectangle overlay:", error);
      toast({
        title: "Error",
        description: "An error occurred while generating rectangle overlay",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
        <div className="mb-4">
          <p className="text-sm text-gray-500">Template ID: {selectedTemplate.id}</p>
          <p className="text-sm text-gray-500">Image URL: {selectedTemplate.image_url}</p>
          {imageDimensions && (
            <p className="text-sm text-gray-500">
              Image dimensions: {imageDimensions.naturalWidth}x{imageDimensions.naturalHeight} (natural), 
              {imageDimensions.renderedWidth}x{imageDimensions.renderedHeight} (rendered), 
              offset: ({imageDimensions.offsetX}, {imageDimensions.offsetY})
            </p>
          )}
        </div>
      )}
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
            src={`/api/meme-proxy?path=${encodeURIComponent(selectedTemplate.image_url)}` || "/placeholder.svg"}
            alt="Meme"
            className="w-full h-full object-contain"
            onLoad={() => {
              log(`Image loaded via proxy for: ${selectedTemplate.image_url}`)
              setImageLoaded(true)
              // Update image dimensions after the image is loaded
              setTimeout(updateImageDimensions, 100) // Small delay to ensure the image is fully rendered
            }}
            onError={(e) => {
              log(`Error loading image via proxy for: ${selectedTemplate.image_url}`)
              // If proxy fails, try direct URL as fallback
              const imgElement = e.target as HTMLImageElement
              if (selectedTemplate.image_url) {
                if (selectedTemplate.image_url.startsWith('http')) {
                  log(`Falling back to direct URL: ${selectedTemplate.image_url}`)
                  imgElement.src = selectedTemplate.image_url
                  // Update dimensions after fallback image is loaded
                  imgElement.onload = () => {
                    setImageLoaded(true)
                    setTimeout(updateImageDimensions, 100)
                  }
                } else if (selectedTemplate.image_url.startsWith('/')) {
                  // Try direct CDN URL
                  const cdnUrl = `https://memulacra.nyc3.digitaloceanspaces.com${selectedTemplate.image_url}`
                  log(`Falling back to direct CDN URL: ${cdnUrl}`)
                  imgElement.src = cdnUrl
                  // Update dimensions after fallback image is loaded
                  imgElement.onload = () => {
                    setImageLoaded(true)
                    setTimeout(updateImageDimensions, 100)
                  }
                }
              }
            }}
          />
          {imageLoaded && boxes.map((box) => (
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
      {/* Text Box Labels Section */}
      {imageLoaded && boxes.length > 0 && (
        <div className="mt-4 mb-4 border border-gray-200 rounded-md p-4">
          <h3 className="text-lg font-semibold mb-2">Text Box Labels</h3>
          <div className="space-y-4">
            {boxes.map((box) => (
              <div key={`label-${box.id}`} className="flex flex-col">
                <div className="flex items-center">
                  <span className="mr-2 font-medium">Text Box {box.id}:</span>
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    placeholder={`Enter label for text box ${box.id}`}
                    value={box.label || ''}
                    onChange={(e) => updateBox(box.id, { label: e.target.value })}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1 ml-2">
                  x1: {box.x.toFixed(2)}%, y1: {box.y.toFixed(2)}%, 
                  x2: {(box.x + box.width).toFixed(2)}%, y2: {(box.y + box.height).toFixed(2)}%
                </div>
                {imageDimensions && (
                  <div className="text-xs text-gray-500 mt-1 ml-2">
                    Image coordinates: x1: {containerToImageCoordinates(box).x.toFixed(2)}%, 
                    y1: {containerToImageCoordinates(box).y.toFixed(2)}%, 
                    x2: {(containerToImageCoordinates(box).x + containerToImageCoordinates(box).width).toFixed(2)}%, 
                    y2: {(containerToImageCoordinates(box).y + containerToImageCoordinates(box).height).toFixed(2)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <div className="flex space-x-2">
          <Button onClick={addBox} disabled={isLoading}>
            <Plus className="mr-2 h-4 w-4" /> Add Box
          </Button>
          <Button onClick={testRectangleOverlay} disabled={isLoading || !selectedTemplate || boxes.length === 0}>
            <Layers className="mr-2 h-4 w-4" /> Test Rectangle Overlay
          </Button>
        </div>
        <div className="flex space-x-2">
          <Button onClick={saveBoxCoordinates} disabled={isLoading}>
            <Download className="mr-2 h-4 w-4" /> {isLoading ? "Saving..." : "Save Box Coordinates"}
          </Button>
          <Button onClick={clearTextBoxes} disabled={isLoading} variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Clear Text Boxes
          </Button>
        </div>
      </div>

      {/* Rectangle Overlay Preview */}
      {overlayImageUrl && (
        <div className="mt-4 mb-4 border border-gray-200 rounded-md p-4">
          <h3 className="text-lg font-semibold mb-2">Rectangle Overlay Preview</h3>
          <img 
            src={overlayImageUrl} 
            alt="Rectangle Overlay" 
            className="w-full object-contain max-h-[500px]" 
          />
        </div>
      )}

      {/* Debug log display */}
      <div className="mt-8 border border-gray-200 rounded-md p-4">
        <h3 className="text-lg font-semibold mb-2">Debug Logs</h3>
        <div className="bg-gray-100 p-2 rounded-md max-h-40 overflow-y-auto text-xs font-mono">
          {logMessages.map((msg, i) => (
            <div key={i} className="mb-1">{msg}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
