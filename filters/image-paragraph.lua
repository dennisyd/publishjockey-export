-- This filter is now a no-op to avoid errors with inline images.
-- Pandoc already puts block images in their own paragraph, so no action is needed.
-- Leaving this filter as a no-op for compatibility.

function Image(img)
  return nil
end 