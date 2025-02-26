# Meme Template Configuration Tool

## Overview

The Meme Template Configuration Tool is a single-page web application designed to improve meme generation quality by allowing precise configuration of text placement and formatting for each meme template. This tool addresses the current limitations in text positioning and readability by providing a visual editor for template-specific text box configurations.

## Problem Statement

Current meme generation uses fixed positioning for text, which leads to several issues:

- Text often overlaps important image content
- Text positioning doesn't adapt to different template layouts
- Text can be cut off or poorly positioned
- No template-specific configuration for optimal text placement

## Solution

A visual editor that allows:

1. Template-specific text box positioning and sizing
2. Configuration of text properties (character limits, alignment)
3. Real-time preview of text rendering
4. Saving configurations to the database for use in the meme generation pipeline

## Features

### Template Selection
- Dropdown menu to select from available meme templates
- Thumbnail preview of selected template
- Filter/search functionality for finding templates

### Visual Editor
- Interactive canvas displaying the template image
- Draggable and resizable text boxes
- Grid snapping for precise positioning
- Zoom and pan controls for detailed editing

### Text Box Configuration
- Position (X, Y coordinates)
- Dimensions (width, height)
- Maximum character limit
- Text alignment (left, center, right)
- Default text for preview purposes

### Preview
- Real-time rendering of sample text with current settings
- Toggle between different sample texts to test configuration
- Mobile/desktop view toggle to test responsiveness

### Configuration Management
- Save configuration to database
- Reset to default configuration
- Copy configuration from another template
- Export/import configurations

## Technical Implementation

### Database Schema Changes

```sql
ALTER TABLE meme_templates 
ADD COLUMN text_box_positions JSONB DEFAULT NULL;
```

The `text_box_positions` field will store a JSON object with the following structure:

```json
{
  "boxes": [
    {
      "id": 1,
      "x": 0.1,  // Normalized coordinates (0-1)
      "y": 0.05,
      "width": 0.8,
      "height": 0.2,
      "max_chars": 100,
      "align": "center"
    },
    {
      "id": 2,
      "x": 0.1,
      "y": 0.75,
      "width": 0.8,
      "height": 0.2,
      "max_chars": 100,
      "align": "center"
    }
    // Additional text boxes as needed
  ]
}
```

### API Endpoints

#### Get Template Configuration
```
GET /api/templates/{template_id}/configuration
```

Response:
```json
{
  "template_id": "123",
  "name": "Drake Hotline Bling",
  "image_url": "/templates/drake.jpg",
  "text_box_positions": {
    "boxes": [...]
  }
}
```

#### Save Template Configuration
```
POST /api/templates/{template_id}/configuration
```

Request Body:
```json
{
  "text_box_positions": {
    "boxes": [...]
  }
}
```

#### Generate Preview Meme
```
POST /api/templates/{template_id}/preview
```

Request Body:
```json
{
  "text_box_positions": {
    "boxes": [...]
  },
  "texts": ["Sample text 1", "Sample text 2"]
}
```

Response:
```json
{
  "preview_url": "/previews/temp_123456.jpg"
}
```

### Frontend Components

#### TemplateSelector
- Displays available templates
- Handles template selection and loading

#### CanvasEditor
- Manages the interactive canvas
- Handles drag, resize, and other user interactions
- Renders the template image and text boxes

#### TextBoxProperties
- Form for editing text box properties
- Updates the canvas in real-time

#### PreviewPanel
- Displays the rendered preview
- Provides sample text options

#### ConfigurationControls
- Save, reset, and other configuration management options

### Technology Stack

#### Frontend
- React for UI components
- Canvas API or fabric.js for the interactive editor
- React-draggable for text box positioning
- Axios for API requests

#### Backend
- Extend existing FastAPI/Flask endpoints
- PIL/Pillow for image processing and preview generation
- PostgreSQL with JSONB for configuration storage

#### DevOps
- Docker for containerization
- CI/CD pipeline for automated testing and deployment

## Development Roadmap

### Phase 1: Core Functionality
1. Database schema updates
2. Basic API endpoints
3. Simple UI with draggable text boxes
4. Save/load functionality

### Phase 2: Enhanced Editing
1. Improved text rendering preview
2. Additional text properties (font, color options)
3. Grid and alignment tools
4. Undo/redo functionality

### Phase 3: Advanced Features
1. Batch configuration of multiple templates
2. Template categorization and tagging
3. User-specific configurations
4. Analytics on meme performance by configuration

## Integration with Existing System

The tool will integrate with the current meme generation pipeline by:

1. Storing configurations in the same database used by the main application
2. Updating the `TextOverlay` class to check for and use template-specific configurations
3. Providing a seamless workflow from configuration to meme generation

## Benefits

1. **Improved Meme Quality**: Better text positioning and readability
2. **Efficiency**: Reduced need for manual adjustments or regeneration
3. **Consistency**: Standardized approach to text placement across templates
4. **Flexibility**: Easy updates to configurations as templates or requirements change

## Future Considerations

- Machine learning to suggest optimal text placement based on image content analysis
- User feedback loop to improve configurations based on popularity metrics
- Support for animated meme templates (GIFs)
- Integration with third-party meme template repositories
